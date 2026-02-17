import { StripHtml, COMMON_KEYWORDS } from "../utils.js";
import { createLocationPreFilter } from "../core/Locationprefilters.js";

export const deutscheTelekomConfig = {
    siteName: "Deutsche Telekom",
    apiUrl: "https://careers.telekom.com/api/jobs-proxy/search",
    method: "POST",
    needsDescriptionScraping: false,
    filterKeywords: [...COMMON_KEYWORDS],

    buildPageUrl: (offset, limit) => {
        const page = Math.floor(offset / limit) + 1;
        return `${deutscheTelekomConfig.apiUrl}?page=${page}`;
    },

    getBody: () => ({
        user_query: "",
        locale: "en"
    }),

    getJobs: (data) => data?.data || [],
    getTotal: (data) => data?.pagination_info?.count || 0,

    // Raw job has 'location', 'city', 'country' fields
    preFilter: createLocationPreFilter({
        locationFields: ['location', 'city', 'country']
    }),

    mapper: (job) => ({
        JobTitle: job.job_title || "",
        JobID: job.requisition_id || "",
        Location: job.location || `${job.city || ""}, ${job.country || ""}`.replace(/^, /, ""),
        PostingDate: job.creation_datetime || "",
        ExpirationDate: "",
        Department: job.category || "N/A",
        Description: StripHtml(job.job_description || ""),
        ApplicationURL: job.apply_url || "",
        ContractType: job.job_type || "N/A",
        ExperienceLevel: job.experience_level || "N/A",
        Compensation: "N/A",
        Company: job.company || "Deutsche Telekom"
    })
};