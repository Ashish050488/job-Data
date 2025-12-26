import { StripHtml } from "../utils.js";
import fetch from 'node-fetch';
import { AbortController } from 'abort-controller';

export const symriseConfig = {
    siteName: "Symrise",
    apiUrl: "https://emea3.recruitmentplatform.com/fo/rest/jobs",
    method: "POST",
    needsDescriptionScraping: true,

    customHeaders: {
        "accept": "application/json",
        "origin": "https://www.symrise.com",
        "referer": "https://www.symrise.com/",
        "lumesse-language": "EN",
        "username": "Q7UFK026203F3VBQB68V7V70S:guest:FO",
        "password": "guest"
    },

    filterKeywords: [
        "project manager", "program manager", "product manager", "product owner",
        "lead", "team lead", "tech lead", "engineering manager",
        "head of", "director", "chief", "vp", "vice president",
        "principal", "senior", "leiter", "manager", "direktor", "projektleiter", "teamleiter"
    ],
    
    preFilter: (rawJob) => {
        return rawJob?.jobFields?.SLOVLIST5 === "Germany";
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
    
    getDetails: async (job, sessionHeaders) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        try {
            const detailsApiUrl = `https://emea3.recruitmentplatform.com/fo/rest/jobs/${job.id}/details`;
            
            const res = await fetch(detailsApiUrl, { 
                headers: { ...sessionHeaders, ...(symriseConfig.customHeaders || {}) }, 
                signal: controller.signal 
            });

            if (!res.ok) { return {}; }
            
            const detailedJob = await res.json();
            
            // Check if customFields exist, otherwise fallback to structuredData description
            let descriptionHtml = (detailedJob.customFields || [])
                .map(field => `<h2>${field.title}</h2>\n${field.content}`)
                .join('\n\n');

            if (!descriptionHtml && detailedJob.structuredData?.description) {
                descriptionHtml = detailedJob.structuredData.description;
            }

            const postingDate = detailedJob.structuredData?.datePosted 
                ? new Date(detailedJob.structuredData.datePosted).toISOString().split('T')[0] 
                : "";
                
            const expirationDate = detailedJob.structuredData?.validThrough 
                ? new Date(detailedJob.structuredData.validThrough).toISOString().split('T')[0] 
                : "";
            
            return {
                // FALLBACK: Ensure Description is never just an empty string
                Description: StripHtml(descriptionHtml) || "Description available on company site.",
                PostingDate: postingDate,
                ExpirationDate: expirationDate,
            };
        } catch (e) {
            console.error(`[Symrise] Error fetching details for job ${job.id}: ${e.message}`);
            return {};
        } finally {
            clearTimeout(timeoutId);
        }
    },
    
    mapper: (job) => {
        const publicPostUrl = `https://www.symrise.com/your-career/search-and-apply/search-and-apply/?jobId=${job.id}&sortBy=DPOSTINGSTART&sortOrder=desc&languageSelect=EN`;

        return {
            JobTitle: job.jobFields?.jobTitle || job.jobFields?.sJobTitle || "N/A",
            JobID: String(job.id || ""),
            Location: `${job.jobFields?.SLOVLIST6 || ""}, ${job.jobFields?.SLOVLIST5 || ""}`.replace(/^, /, ""),
            PostingDate: "", 
            Department: job.jobFields?.SLOVLIST7 || "N/A",
            Description: "", // Triggers getDetails in processor.js
            ApplicationURL: publicPostUrl, 
            ContractType: job.jobFields?.CONTRACTTYPLABEL || "N/A",
            ExperienceLevel: "N/A",
            Company: "Symrise"
        };
    }
};