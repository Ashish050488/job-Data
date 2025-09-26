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
    
    // ✅ FIX: This function now includes the required headers and uses the correct data paths.
    getDetails: async (job, sessionHeaders) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        try {
            const detailsApiUrl = `https://emea3.recruitmentplatform.com/fo/rest/jobs/${job.id}/details`;
            
            // The details endpoint requires the same custom headers as the main list.
            const res = await fetch(detailsApiUrl, { 
                headers: { ...sessionHeaders, ...(symriseConfig.customHeaders || {}) }, 
                signal: controller.signal 
            });

            if (!res.ok) { return {}; }
            
            const detailedJob = await res.json();
            
            // Use the reliable date strings from the structuredData object.
            const postingDate = detailedJob.structuredData?.datePosted 
                ? new Date(detailedJob.structuredData.datePosted).toISOString().split('T')[0] 
                : "";
                
            const expirationDate = detailedJob.structuredData?.validThrough 
                ? new Date(detailedJob.structuredData.validThrough).toISOString().split('T')[0] 
                : "";
            
            return {
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
        const description = (job.customFields || [])
            .map(field => `<h2>${field.title}</h2>\n${field.content}`)
            .join('\n\n');

        return {
            JobTitle: job.jobFields?.jobTitle || "",
            JobID: String(job.jobFields?.id || ""),
            Location: `${job.jobFields?.SLOVLIST6 || ""}, ${job.jobFields?.SLOVLIST5 || ""}`.replace(/^, /, ""),
            PostingDate: "", // Placeholder, will be filled by getDetails
            ExpirationDate: "", // Placeholder, will be filled by getDetails
            Department: job.jobFields?.SLOVLIST7 || "N/A",
            Description: StripHtml(description),
            ApplicationURL: job.jobFields?.applicationUrl || "",
            ContractType: job.jobFields?.CONTRACTTYPLABEL || "N/A",
            ExperienceLevel: "N/A",
            Compensation: "N/A"
        };
    }
};

