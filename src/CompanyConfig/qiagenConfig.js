import { StripHtml } from "../utils.js";
import fetch from 'node-fetch';
import { AbortController } from 'abort-controller';

export const qiagenConfig = {
    siteName: "QIAGEN",
    apiUrl: "https://global3.recruitmentplatform.com/fo/rest/jobs",
    method: "POST",
    needsDescriptionScraping: true,

    // These are the special authentication headers required by this API.
    customHeaders: {
        "accept": "application/json",
        "origin": "https://www.qiagen.com",
        "referer": "https://www.qiagen.com/",
        "lumesse-language": "EN",
        // This username is specific to the QIAGEN career portal.
        "username": "PJBFK026203F3VBQB6879LOOB:guest:FO",
        "password": "guest"
    },

    // Keywords our scraper engine will use to filter the results.
    filterKeywords: [
        "project manager", "program manager", "product manager", "product owner",
        "lead", "team lead", "tech lead", "engineering manager",
        "head of", "director", "chief", "vp", "vice president",
        "principal", "senior", "leiter", "manager", "direktor", "projektleiter", "teamleiter"
    ],
    
    // This pre-filter is a reliable check that runs first, ensuring only German jobs are processed.
    preFilter: (rawJob) => {
        return rawJob?.jobFields?.SLOVLIST26 === "Germany";
    },

    // This function builds the URL with the correct pagination parameters.
    buildPageUrl: (offset, limit) => {
        const params = new URLSearchParams({
            firstResult: offset,
            maxResults: limit,
            sortBy: 'sJobTitle',
            sortOrder: 'asc'
        });
        return `https://global3.recruitmentplatform.com/fo/rest/jobs?${params.toString()}`;
    },

    // The body contains the search criteria to hint to the API.
    getBody: () => ({
        "searchCriteria": [{ "key": "LOV26", "values": ["Germany"] }]
    }),

    getTotal: (data) => data?.globals?.jobsCount || 0,
    getJobs: (data) => data?.jobs || [],
    
    // This function fetches the full details for a single job to get the date information.
    getDetails: async (job, sessionHeaders) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        try {
            const detailsApiUrl = `https://global3.recruitmentplatform.com/fo/rest/jobs/${job.id}/details`;
            const res = await fetch(detailsApiUrl, { 
                headers: { ...sessionHeaders, ...(qiagenConfig.customHeaders || {}) }, 
                signal: controller.signal 
            });
            if (!res.ok) return {};
            
            const detailedJob = await res.json();
            
            const postingDate = detailedJob.structuredData?.datePosted 
                ? new Date(detailedJob.structuredData.datePosted).toISOString().split('T')[0] 
                : "";
                
            const expirationDate = detailedJob.structuredData?.validThrough
                ? new Date(detailedJob.structuredData.validThrough).toISOString().split('T')[0] 
                : "";
            
            return {
                PostingDate: postingDate,
                ExpirationDate: expirationDate,
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
            PostingDate: "", // Placeholder, will be filled by getDetails
            ExpirationDate: "", // Placeholder, will be filled by getDetails
            Department: job.jobFields?.SLOVLIST7 || "N/A", // This might not be the correct department field
            Description: StripHtml(description),
            ApplicationURL: job.jobFields?.applicationUrl || "",
            ContractType: job.jobFields?.CONTRACTTYPLABEL || "N/A",
            ExperienceLevel: "N/A",
            Compensation: "N/A"
        };
    }
};
