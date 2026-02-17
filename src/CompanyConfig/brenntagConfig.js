import { StripHtml, COMMON_KEYWORDS } from "../utils.js";
import { createLocationPreFilter } from "../core/Locationprefilters.js";
import fetch from 'node-fetch';
import { AbortController } from 'abort-controller';

export const brenntagConfig = {
    siteName: "Brenntag",
    apiUrl: "https://brenntag.wd3.myworkdayjobs.com/wday/cxs/brenntag/brenntag_jobs/jobs",
    baseUrl: "https://brenntag.wd3.myworkdayjobs.com/brenntag_jobs",
    method: "POST",
    needsSession: true,
    needsDescriptionScraping: true,
    filterKeywords: [...COMMON_KEYWORDS],

    getBody: (offset, limit) => ({
        "appliedFacets": { "Country": ["dcc5b7608d8644b3a93716604e78e995"] },
        "limit": 20,
        "offset": offset,
        "searchText": ""
    }),

    getTotal: (data) => data?.total || 0,
    getJobs: (data) => data?.jobPostings || [],

    // Workday raw job has 'locationsText' field
    preFilter: createLocationPreFilter({
        locationFields: ['locationsText', 'title']
    }),

    getDetails: async (job, sessionHeaders) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);
        try {
            const detailsApiUrl = `https://brenntag.wd3.myworkdayjobs.com/wday/cxs/brenntag/brenntag_jobs${job.externalPath}`;
            const res = await fetch(detailsApiUrl, { headers: sessionHeaders, signal: controller.signal });
            if (!res.ok) { return { skip: true }; }
            const data = await res.json();
            const jobInfo = data?.jobPostingInfo;
            if (jobInfo?.jobRequisitionLocation?.country?.descriptor !== "Germany") { return { skip: true }; }
            return {
                Description: StripHtml(jobInfo?.jobDescription || ""),
                ContractType: jobInfo?.timeType || "N/A",
                Location: jobInfo?.jobRequisitionLocation?.descriptor || jobInfo?.location || "N/A",
                PostingDate: jobInfo?.startDate || "",
                ExpirationDate: jobInfo?.endDate || ""
            };
        } catch (error) {
            console.error(`[Brenntag] Error getting details for job ${job.bulletFields?.[0]}: ${error.message}`);
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
        ExpirationDate: "",
        Department: "",
        Description: "",
        ApplicationURL: `https://brenntag.wd3.myworkdayjobs.com/brenntag_jobs${job.externalPath}`,
        ContractType: "",
        ExperienceLevel: "N/A",
        Compensation: "N/A"
    })
};