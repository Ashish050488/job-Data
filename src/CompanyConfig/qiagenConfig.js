import { StripHtml, COMMON_KEYWORDS } from "../utils.js";
import { createLocationPreFilter } from "../core/Locationprefilters.js";
import fetch from 'node-fetch';
import { AbortController } from 'abort-controller';

export const qiagenConfig = {
    siteName: "QIAGEN",
    apiUrl: "https://global3.recruitmentplatform.com/fo/rest/jobs",
    method: "POST",
    needsDescriptionScraping: true,
    filterKeywords: [...COMMON_KEYWORDS],

    customHeaders: {
        "accept": "application/json",
        "origin": "https://www.qiagen.com",
        "referer": "https://www.qiagen.com/",
        "lumesse-language": "EN",
        "username": "PJBFK026203F3VBQB6879LOOB:guest:FO",
        "password": "guest"
    },

    buildPageUrl: (offset, limit) => {
        const params = new URLSearchParams({
            firstResult: offset,
            maxResults: limit,
            sortBy: 'sJobTitle',
            sortOrder: 'asc'
        });
        return `https://global3.recruitmentplatform.com/fo/rest/jobs?${params.toString()}`;
    },

    getBody: () => ({
        "searchCriteria": [{ "key": "LOV26", "values": ["Germany"] }]
    }),

    getTotal: (data) => data?.globals?.jobsCount || 0,
    getJobs: (data) => data?.jobs || [],

    // QIAGEN has SLOVLIST26 = "Germany" as the country field
    preFilter: (rawJob) => {
        const locationText = `${rawJob?.jobFields?.SLOVLIST27 || ""} ${rawJob?.jobFields?.SLOVLIST26 || ""}`;
        return createLocationPreFilter({ locationFields: [] })({ location: locationText });
    },

    getDetails: async (job, sessionHeaders) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);
        try {
            const detailsApiUrl = `https://global3.recruitmentplatform.com/fo/rest/jobs/${job.id}/details`;
            const res = await fetch(detailsApiUrl, {
                headers: { ...sessionHeaders, ...(qiagenConfig.customHeaders || {}) },
                signal: controller.signal
            });
            if (!res.ok) return {};
            const detailedJob = await res.json();
            return {
                PostingDate: detailedJob.structuredData?.datePosted
                    ? new Date(detailedJob.structuredData.datePosted).toISOString().split('T')[0] : "",
                ExpirationDate: detailedJob.structuredData?.validThrough
                    ? new Date(detailedJob.structuredData.validThrough).toISOString().split('T')[0] : "",
                ContractType: detailedJob.jobFields?.CONTRACTTYPLABEL || "N/A",
            };
        } catch (e) {
            console.error(`[QIAGEN] Error fetching details for job ${job.id}: ${e.message}`);
            return {};
        } finally {
            clearTimeout(timeoutId);
        }
    },

    mapper: (job) => {
        const description = (job.customFields || [])
            .map(field => `<h2>${field.title}</h2>\n${field.content}`)
            .join('\n\n');
        return {
            JobTitle: job.jobFields?.jobTitle || "",
            JobID: String(job.jobFields?.id || ""),
            Location: `${job.jobFields?.SLOVLIST27 || ""}, ${job.jobFields?.SLOVLIST26 || ""}`.replace(/^, /, ""),
            PostingDate: "",
            ExpirationDate: "",
            Department: job.jobFields?.SLOVLIST7 || "N/A",
            Description: StripHtml(description),
            ApplicationURL: job.jobFields?.applicationUrl || "",
            ContractType: job.jobFields?.CONTRACTTYPLABEL || "N/A",
            ExperienceLevel: "N/A",
            Compensation: "N/A"
        };
    }
};