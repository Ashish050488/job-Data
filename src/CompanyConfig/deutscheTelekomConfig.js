import { StripHtml, COMMON_KEYWORDS } from "../utils.js";

export const deutscheTelekomConfig = {
    siteName: "Deutsche Telekom",
    
    // ✅ FIX: Using the new API URL you found
    apiUrl: "https://careers.telekom.com/api/jobs-proxy/search",
    
    // ✅ FIX: Changed to POST
    method: "POST",

    // ✅ FIX: This API is paginated with query params, not in the body.
    // We create a function to build the URL with the correct page number.
    buildPageUrl: (offset, limit) => {
        // The API uses 1-based page numbers, not 0-based offset
        const page = Math.floor(offset / limit) + 1;
        return `${deutscheTelekomConfig.apiUrl}?page=${page}`;
    },

    // ✅ FIX: This is the simple payload body the POST request needs.
    // The page number is handled in the URL now.
    getBody: (offset, limit) => ({
        user_query: "",
        locale: "en"
    }),

    // ✅ FIX: The jobs are in the `data` array
    getJobs: (data) => data?.data || [],
    
    // ✅ FIX: The total count is in `pagination_info.count`
    getTotal: (data) => data?.pagination_info?.count || 0,

    // ✅ FIX: We no longer need to scrape the details page.
    // The new API provides the full description in the first call!
    // This makes the scraper much faster.
    needsDescriptionScraping: false,

    filterKeywords: [...COMMON_KEYWORDS],

    // ✅ FIX: Mapper is completely updated for the new API structure
    mapper: (job) => ({
        JobTitle: job.job_title || "",
        JobID: job.requisition_id || "",
        Location: job.location || `${job.city}, ${job.country}`,
        PostingDate: job.creation_datetime || "",
        Department: job.category || "N/A",
        
        // We get the full description directly from the API
        Description: StripHtml(job.job_description || ""), 
        
        ApplicationURL: job.apply_url || "",
        ContractType: job.job_type || "N/A",
        ExperienceLevel: job.experience_level || "N/A",
        Company: job.company || "Deutsche Telekom"
    })
};