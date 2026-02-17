import { StripHtml, COMMON_KEYWORDS } from "../utils.js";
import { createLocationPreFilter } from "../core/Locationprefilters.js";
import fetch from 'node-fetch';
import { AbortController } from 'abort-controller';

export const heidelbergMaterialsConfig = {
    siteName: "Heidelberg Materials",
    apiUrl: "https://heidelbergmaterials.wd3.myworkdayjobs.com/wday/cxs/heidelbergmaterials/Global_HM_Career_Site/jobs",
    baseUrl: "https://heidelbergmaterials.wd3.myworkdayjobs.com/Global_HM_Career_Site",
    method: "POST",
    needsSession: true,
    needsDescriptionScraping: true,
    filterKeywords: [...COMMON_KEYWORDS],

    getBody: (offset, limit) => ({
        "appliedFacets": { "locationCountry": ["dcc5b7608d8644b3a93716604e78e995"] },
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
            const detailsApiUrl = `https://heidelbergmaterials.wd3.myworkdayjobs.com/wday/cxs/heidelbergmaterials/Global_HM_Career_Site${job.externalPath}`;
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
            console.error(`[Heidelberg Materials] Error getting details for job ${job.bulletFields?.[0]}: ${error.message}`);
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
        ApplicationURL: `https://heidelbergmaterials.wd3.myworkdayjobs.com/Global_HM_Career_Site${job.externalPath}`,
        ContractType: "",
        ExperienceLevel: "N/A",
        Compensation: "N/A"
    })
};