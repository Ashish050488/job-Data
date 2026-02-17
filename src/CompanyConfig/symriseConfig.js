import { StripHtml, COMMON_KEYWORDS } from "../utils.js";
import { createLocationPreFilter } from "../core/Locationprefilters.js";
import fetch from 'node-fetch';
import { AbortController } from 'abort-controller';

export const symriseConfig = {
    siteName: "Symrise",
    apiUrl: "https://emea3.recruitmentplatform.com/fo/rest/jobs",
    method: "POST",
    needsDescriptionScraping: true,
    filterKeywords: [...COMMON_KEYWORDS],

    customHeaders: {
        "accept": "application/json",
        "origin": "https://www.symrise.com",
        "referer": "https://www.symrise.com/",
        "lumesse-language": "EN",
        "username": "Q7UFK026203F3VBQB68V7V70S:guest:FO",
        "password": "guest"
    },

    buildPageUrl: (offset, limit) => {
        const params = new URLSearchParams({
            firstResult: offset,
            maxResults: limit,
            sortBy: 'DPOSTINGSTART',
            sortOrder: 'desc'
        });
        return `https://emea3.recruitmentplatform.com/fo/rest/jobs?${params.toString()}`;
    },

    getBody: () => ({
        "searchCriteria": [{ "key": "LOV5", "values": ["Germany"] }]
    }),

    getTotal: (data) => data?.globals?.jobsCount || 0,
    getJobs: (data) => data?.jobs || [],

    // SLOVLIST5 = country ("Germany"), SLOVLIST6 = city
    preFilter: (rawJob) => {
        const locationText = `${rawJob?.jobFields?.SLOVLIST6 || ""} ${rawJob?.jobFields?.SLOVLIST5 || ""}`;
        return createLocationPreFilter({ locationFields: [] })({ location: locationText });
    },

    getDetails: async (job, sessionHeaders) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);
        try {
            const detailsApiUrl = `https://emea3.recruitmentplatform.com/fo/rest/jobs/${job.id}/details`;
            const res = await fetch(detailsApiUrl, {
                headers: { ...sessionHeaders, ...(symriseConfig.customHeaders || {}) },
                signal: controller.signal
            });
            if (!res.ok) { return {}; }
            const detailedJob = await res.json();
            let descriptionHtml = (detailedJob.customFields || [])
                .map(field => `<h2>${field.title}</h2>\n${field.content}`)
                .join('\n\n');
            if (!descriptionHtml && detailedJob.structuredData?.description) {
                descriptionHtml = detailedJob.structuredData.description;
            }
            return {
                Description: StripHtml(descriptionHtml) || "Description available on company site.",
                PostingDate: detailedJob.structuredData?.datePosted
                    ? new Date(detailedJob.structuredData.datePosted).toISOString().split('T')[0] : "",
                ExpirationDate: detailedJob.structuredData?.validThrough
                    ? new Date(detailedJob.structuredData.validThrough).toISOString().split('T')[0] : "",
            };
        } catch (e) {
            console.error(`[Symrise] Error fetching details for job ${job.id}: ${e.message}`);
            return {};
        } finally {
            clearTimeout(timeoutId);
        }
    },

    mapper: (job) => ({
        JobTitle: job.jobFields?.jobTitle || job.jobFields?.sJobTitle || "",
        JobID: String(job.id || ""),
        Location: `${job.jobFields?.SLOVLIST6 || ""}, ${job.jobFields?.SLOVLIST5 || ""}`.replace(/^, /, ""),
        PostingDate: "",
        ExpirationDate: "",
        Department: job.jobFields?.SLOVLIST7 || "N/A",
        Description: "",
        ApplicationURL: `https://www.symrise.com/your-career/search-and-apply/search-and-apply/?jobId=${job.id}&sortBy=DPOSTINGSTART&sortOrder=desc&languageSelect=EN`,
        ContractType: job.jobFields?.CONTRACTTYPLABEL || "N/A",
        ExperienceLevel: "N/A",
        Compensation: "N/A",
        Company: "Symrise"
    })
};