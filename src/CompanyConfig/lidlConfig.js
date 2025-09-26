import { StripHtml, COMMON_KEYWORDS } from '../utils.js';

export const lidlDeConfig = {
    siteName: 'Lidl DE',
    baseUrl: 'https://jobs.lidl.de',
    apiUrl: 'https://jobs.lidl.de/search_api/jobsearch',
    method: 'GET',

    needsDescriptionScraping: false,
    preFilter: (rawJob) => rawJob.location.country === 'Germany',

    // ✅ FIX: This function now accepts and uses the filterKeywords
    buildPageUrl: (offset, limit, filterKeywords) => {
        const page = Math.floor(offset / limit) + 1;
        const searchTerm = filterKeywords.join(' '); // Combine keywords into a single string
        
        const filter = JSON.stringify({
            contract_type: [],
            employment_area: [],
            entry_level: [],
        });
        
        const params = new URLSearchParams({
            term: searchTerm, // Add the search term to the request
            page: page,
            filter: filter,
            with_event: 'true'
        });
        
        return `${lidlDeConfig.apiUrl}?${params.toString()}`;
    },

    getJobs: (data) => data?.result?.hits || [],
    getTotal: (data) => data?.result?.count || 0,
    
    limit: 15,

    mapper: (rawJob) => {
        const location = rawJob.location || {};
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
            ExpirationDate: rawJob.closingDate || rawJob.onlineUntil || "N/A",
            PostedDate: "N/A",
        };
    },

    filterKeywords: COMMON_KEYWORDS,
};