import { COMMON_KEYWORDS, StripHtml } from '../utils.js';

export const sixtConfig = {
    siteName: 'Sixt',
    baseUrl: 'https://www.sixt.jobs',
    apiUrl: 'https://www.sixt.jobs/uk/jobs',
    method: 'POST',
    needsSession: true,
    needsDescriptionScraping: true, 
    descriptionSelector: '#detailPageBody .py-xl',

    /**
     * ✅ FINAL FIX: This function now ignores pagination and fetches up to 500 jobs at once.
     * This gets all German jobs in a single API call, bypassing the broken pagination.
     */
    getBody: (offset, limit, filterKeywords) => {
        return {
            q: filterKeywords.join(' '),
            search: filterKeywords.join(' '),
            country: "DE", // We only want Germany
            page: 1,       // Always request the first page
            limit: 500     // Request a large number of jobs to get all results
        };
    },

    getJobs: (data) => data || [],

    // This ensures the scraper only runs once for this site
    getTotal: (data) => data.length, 

    mapper: (job) => {
        return {
            JobID: job.slug,
            JobTitle: job.title,
            ApplicationURL: `${sixtConfig.baseUrl}${job.url}`,
            Location: `${job.city}, ${job.country}`,
            Department: job.role || "N/A",
            ExperienceLevel: job.level || "N/A",
            ContractType: job.type_of_employment || "N/A",
            PostedDate: job.released_date ? job.released_date.split('T')[0] : "N/A",
            Description: "", 
            Company: "Sixt",
            Compensation: "N/A",
            ExpirationDate: "N/A",
        };
    },

    filterKeywords: COMMON_KEYWORDS,
};