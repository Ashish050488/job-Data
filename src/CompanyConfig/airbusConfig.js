import { StripHtml, COMMON_KEYWORDS } from "../utils.js"


export const airbusConfig ={
        siteName: "Airbus",
        apiUrl: "https://ag.wd3.myworkdayjobs.com/wday/cxs/ag/Airbus/jobs",
        baseUrl: "https://ag.wd3.myworkdayjobs.com/Airbus",
        method: "POST",
        needsSession: true,
        needsDescriptionScraping: true,
        filterKeywords: [...COMMON_KEYWORDS],
        getBody: (offset, limit, keywords) => ({
            "appliedFacets": { "locationCountry": ["dcc5b7608d8644b3a93716604e78e995"] },
            "limit": 20,
            "offset": offset,
            "searchText": ""
        }),
        getJobs: (data) => data?.jobPostings || [],
        getDetails: async (job, sessionHeaders) => {
            const detailsApiUrl = `https://ag.wd3.myworkdayjobs.com/wday/cxs/ag/Airbus${job.externalPath}`;
            const res = await fetch(detailsApiUrl, { headers: sessionHeaders });
            if (!res.ok) { return {}; }
            const data = await res.json();
            const jobInfo = data?.jobPostingInfo;
            if (jobInfo?.jobRequisitionLocation?.country?.descriptor !== "Germany") { return { skip: true }; }
            return {
                Description: StripHtml(jobInfo?.jobDescription || ""),
                Department: jobInfo?.jobRequisitionLocation?.descriptor || "N/A",
                ContractType: jobInfo?.timeType || "N/A",
                Location: jobInfo?.location || jobInfo?.jobRequisitionLocation?.descriptor || "N/A"
            };
        },
        // ✅ THE FINAL FIX: The complete, correct mapper is now included.
        mapper: (job) => ({
            JobTitle: job.title || "",
            JobID: job.bulletFields?.[0] || "",
            Location: job.locationsText || "",
            PostingDate: job.postedOn || "",
            Department: "",
            Description: "",
            ApplicationURL: `https://ag.wd3.myworkdayjobs.com/wday/cxs/ag/Airbus${job.externalPath}`,
            ContractType: "",
            ExperienceLevel: "N/A",
            Compensation: "N/A"
        })
    }