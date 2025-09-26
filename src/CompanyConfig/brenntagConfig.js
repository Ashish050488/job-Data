import { StripHtml } from "../utils.js";
import fetch from 'node-fetch';
import { AbortController } from 'abort-controller';

export const brenntagConfig = {
    siteName: "Brenntag",
    apiUrl: "https://brenntag.wd3.myworkdayjobs.com/wday/cxs/brenntag/brenntag_jobs/jobs",
    baseUrl: "https://brenntag.wd3.myworkdayjobs.com/brenntag_jobs",
    method: "POST",
    needsSession: true,
    needsDescriptionScraping: true,

    // Keywords our scraper engine will use to filter the results.
    filterKeywords: [
        "project manager", "program manager", "product manager", "product owner",
        "lead", "team lead", "tech lead", "engineering manager",
        "head of", "director", "chief", "vp", "vice president",
        "principal", "senior", "leiter", "manager", "direktor", "projektleiter", "teamleiter"
    ],
    
    // This function builds the POST request to fetch all jobs from Germany.
    getBody: (offset, limit) => ({
        "appliedFacets": {
            // This is the unique ID for "Germany" in their system.
            "Country": ["dcc5b7608d8644b3a93716604e78e995"] 
        },
        "limit": 20,
        "offset": offset,
        "searchText": ""
    }),

    getTotal: (data) => data?.total || 0,
    
    getJobs: (data) => data?.jobPostings || [],
    
    // This function fetches the full details for a single job.
    getDetails: async (job, sessionHeaders) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        try {
            // We construct the correct details URL, which is different from the sidebar URL.
            const detailsApiUrl = `https://brenntag.wd3.myworkdayjobs.com/wday/cxs/brenntag/brenntag_jobs${job.externalPath}`;
            const res = await fetch(detailsApiUrl, { 
                headers: sessionHeaders, 
                signal: controller.signal 
            });
            if (!res.ok) { return { skip: true }; }
            
            const data = await res.json();
            const jobInfo = data?.jobPostingInfo;
            
            // This second check ensures the job is in Germany before proceeding.
            if (jobInfo?.jobRequisitionLocation?.country?.descriptor !== "Germany") {
                return { skip: true };
            }

            const postingDate = jobInfo?.startDate || "";
            const expirationDate = jobInfo?.endDate || "";

            return {
                Description: StripHtml(jobInfo?.jobDescription || ""),
                ContractType: jobInfo?.timeType || "N/A",
                Location: jobInfo?.jobRequisitionLocation?.descriptor || jobInfo?.location || "N/A",
                ExpirationDate: expirationDate,
                PostingDate: postingDate
            };
        } catch (error) {
            console.error(`[Brenntag] Error getting details for job ${job.bulletFields?.[0]}: ${error.message}`);
            return { skip: true };
        } finally {
            clearTimeout(timeoutId);
        }
    },
    
    // This function maps the fields from the initial job list.
    mapper: (job) => ({
        JobTitle: job.title || "",
        // The unique ID is reliably in the first element of bulletFields.
        JobID: String(job.bulletFields?.[0] || ""),
        Location: job.locationsText || "",
        PostingDate: "", // Placeholder, will be filled by getDetails
        ExpirationDate: "", // Placeholder, will be filled by getDetails
        Department: "", // Not available in list view
        Description: "", // Placeholder, will be filled by getDetails
        ApplicationURL: `https://brenntag.wd3.myworkdayjobs.com/brenntag_jobs${job.externalPath}`,
        ContractType: "", // Placeholder, will be filled by getDetails
        ExperienceLevel: "N/A",
        Compensation: "N/A"
    })
};
