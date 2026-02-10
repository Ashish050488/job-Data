import { StripHtml, COMMON_KEYWORDS } from "../utils.js";
import { createLocationPreFilter } from "../core/Locationprefilters.js";
import fetch from 'node-fetch';
import { AbortController } from 'abort-controller';

export const covestroConfig = {
    siteName: "Covestro",
    apiUrl: "https://covestro.wd3.myworkdayjobs.com/wday/cxs/covestro/cov_external/jobs",
    baseUrl: "https://covestro.wd3.myworkdayjobs.com/cov_external",
    method: "POST",
    needsSession: true,
    needsDescriptionScraping: true,
    filterKeywords: [...COMMON_KEYWORDS],

    getBody: (offset, limit) => ({
        "appliedFacets": {
            "Location_Country": ["dcc5b7608d8644b3a93716604e78e995"] // Germany filter
        },
        "limit": 20,
        "offset": offset,
        "searchText": ""
    }),

    getTotal: (data) => data?.total || 0,
    getJobs: (data) => data?.jobPostings || [],
    
    // ✅ USE UNIVERSAL PRE-FILTER
    // Workday uses 'locationsText' field for location
    preFilter: createLocationPreFilter({ 
        locationFields: ['locationsText', 'title'] // Check title too for city names
    }),
    
    getDetails: async (job, sessionHeaders) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        try {
            const detailsApiUrl = `https://covestro.wd3.myworkdayjobs.com/wday/cxs/covestro/cov_external${job.externalPath}`;
            const res = await fetch(detailsApiUrl, { 
                headers: sessionHeaders, 
                signal: controller.signal 
            });
            if (!res.ok) { return { skip: true }; }
            
            const data = await res.json();
            const jobInfo = data?.jobPostingInfo;
            
            // Double-check country (API filter already applied, but be safe)
            if (jobInfo?.jobRequisitionLocation?.country?.descriptor !== "Germany") {
                return { skip: true };
            }

            return {
                Description: StripHtml(jobInfo?.jobDescription || ""),
                ContractType: jobInfo?.timeType || "N/A",
                Location: jobInfo?.jobRequisitionLocation?.descriptor || jobInfo?.location || "N/A",
                PostingDate: jobInfo?.startDate || ""
            };
        } catch (error) {
            console.error(`[Covestro] Error getting details: ${error.message}`);
            return { skip: true };
        } finally {
            clearTimeout(timeoutId);
        }
    },
    
    mapper: (job) => ({
        JobTitle: job.title || "",
        JobID: String(job.bulletFields?.[0] || ""),
        Location: job.locationsText || "",
        PostingDate: "",
        Department: "",
        Description: "",
        ApplicationURL: `https://covestro.wd3.myworkdayjobs.com/cov_external${job.externalPath}`,
        ContractType: "",
        ExperienceLevel: "N/A",
        Compensation: "N/A"
    })
};