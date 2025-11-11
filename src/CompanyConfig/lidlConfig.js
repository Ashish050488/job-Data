import { StripHtml, COMMON_KEYWORDS } from '../utils.js';

export const lidlDeConfig = {
    siteName: 'Lidl DE',
    baseUrl: 'https://jobs.lidl.de',
    apiUrl: 'https://jobs.lidl.de/search_api/jobsearch',
    method: 'GET',

    needsDescriptionScraping: false,
    preFilter: (rawJob) => rawJob.location.country === 'Germany',

    /**
     * ✅ --- THIS IS THE FIX --- ✅
     * 1. We send our keywords in the 'term' parameter.
     * 2. We sort by 'postedTs' (timestamp) descending to get newest jobs first.
     */
    buildPageUrl: (offset, limit, filterKeywords) => {
        const page = Math.floor(offset / limit) + 1;
        const searchTerm = filterKeywords.join(' '); // Combine keywords

        const filter = JSON.stringify({
            contract_type: [],
            employment_area: [],
            entry_level: [],
        });
        
        const params = new URLSearchParams({
            term: searchTerm,     // <-- Fix 1: Send keywords to the API
            page: page,
            filter: filter,
            with_event: 'true',
            sort_field: 'postedTs', // <-- Fix 2: Sort by timestamp
            sort_order: 'desc'    // <-- Get newest first
        });
        
        return `${lidlDeConfig.apiUrl}?${params.toString()}`;
    },
    // ✅ --- END OF FIX --- ✅

    getJobs: (data) => data?.result?.hits || [],
    getTotal: (data) => data?.result?.count || 0,
    
    limit: 15,

    mapper: (rawJob) => {
        const location = rawJob.location || {};

        // 'postedTs' is a Unix timestamp (in seconds). Multiply by 1000 for JavaScript.
        const postingDate = rawJob.postedTs 
            ? new Date(rawJob.postedTs * 1000).toISOString() 
            : null; // Set to null, jobModel will handle it

        const expirationDate = rawJob.onlineUntil || rawJob.closingDate || null;

        return {
            JobID: String(rawJob.jobId),
            JobTitle: rawJob.title,
            Description: StripHtml(rawJob.descResponsibilities),
            ApplicationURL: `${lidlDeConfig.baseUrl}${rawJob.url}`,
            Location: [location.address, location.city, location.postcode, location.country]
                .filter(Boolean)
                .join(', '),
            ContractType: rawJob.contractType || "N/A",
            ExperienceLevel: rawJob.entryLevel || "N/A",
            Department: rawJob.employmentAreaTitle || "N/A",
            Compensation: rawJob.salaryValue || "N/A",
            ExpirationDate: expirationDate,
            PostedDate: postingDate,
        };
    },

    filterKeywords: COMMON_KEYWORDS,
};