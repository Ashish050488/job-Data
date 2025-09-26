import { StripHtml, COMMON_KEYWORDS } from '../utils.js';

export const kauflandConfig = {
    siteName: 'Kaufland',
    baseUrl: 'https://jobs.kaufland.de',
    apiUrl: 'https://jobs.kaufland.de/search_api/jobsearch',
    method: 'GET',

    // All data is in the API, no extra page scraping is needed
    needsDescriptionScraping: false,

    // This ensures we only process jobs located in Germany
    preFilter: (rawJob) => rawJob.location.country === 'Germany',

    // This function builds the URL for each page of results, including keywords
    buildPageUrl: (offset, limit, filterKeywords) => {
        const page = Math.floor(offset / limit) + 1;
        const searchTerm = filterKeywords.join(' '); // Combine keywords for the search
        
        // This is the default empty filter used by the website
        const filter = JSON.stringify({
            contract_type: [],
            employment_area: [],
            entry_level: [],
        });
        
        const params = new URLSearchParams({
            term: searchTerm, // Add the search term to the API request
            page: page,
            filter: filter,
            with_event: 'true'
        });
        
        return `${kauflandConfig.apiUrl}?${params.toString()}`;
    },

    getJobs: (data) => data?.result?.hits || [],
    getTotal: (data) => data?.result?.count || 0,
    
    // The API returns 15 jobs per page
    limit: 15,

    mapper: (rawJob) => {
        const location = rawJob.location || {};
        return {
            JobID: String(rawJob.jobId),
            JobTitle: rawJob.title,
            Description: StripHtml(rawJob.descResponsibilities),
            ApplicationURL: `${kauflandConfig.baseUrl}${rawJob.url}`,
            Location: [location.address, location.city, location.postcode, location.country]
                .filter(Boolean) // Removes any empty or null parts
                .join(', '),
            ContractType: rawJob.contractType || "N/A",
            ExperienceLevel: rawJob.entryLevel || "N/A",
            Department: rawJob.employmentAreaTitle || "N/A",
            Compensation: rawJob.salaryValue || "N/A",
            ExpirationDate: rawJob.closingDate || rawJob.onlineUntil || "N/A",
            PostedDate: "N/A", // This information is not provided in the API
        };
    },

    filterKeywords: COMMON_KEYWORDS,
};