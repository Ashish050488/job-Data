import { COMMON_KEYWORDS, StripHtml } from '../utils.js';

export const auto1GroupConfig = {
    siteName: 'AUTO1 Group',
    baseUrl: 'https://www.auto1-group.com/jobs/',
    apiUrl: 'https://www.auto1-group.com/smart-recruiters/jobs/search/',
    method: 'POST',
    needsDescriptionScraping: true, 
    descriptionSelector: '[itemprop="description"]',

    /**
     * ✅ FINAL FIX: This function now builds the correct request body,
     * using the nested 'options' object for pagination as you discovered.
     */
    getBody: (offset, limit, filterKeywords) => {
        // Convert the scraper's 'offset' to the API's 'currentPage'
        // The API seems to be 1-based, so page 0 becomes 1, page 20 becomes 2, etc.
        const currentPage = Math.floor(offset / limit) + 1;

        return {
            query: filterKeywords.join(' '),
            filters: {
                country: "Germany" // Correct filter key
            },
            options: {
                currentPage: currentPage, // Correct pagination parameter
                resultsPerPage: limit
            }
        };
    },

    getJobs: (data) => data?.jobs?.hits || [],
    getTotal: (data) => data?.jobs?.total?.value || 0,
    
    // The API uses 15 results per page according to your payload
    limit: 15, 

    mapper: (rawJob) => {
        const job = rawJob._source;
        let description = '';
        if (job.jobAd?.sections) {
            const { companyDescription, jobDescription, qualifications, additionalInformation } = job.jobAd.sections;
            description += (companyDescription?.text || '');
            description += (jobDescription?.text || '');
            description += (qualifications?.text || '');
            description += (additionalInformation?.text || '');
        }

        return {
            JobID: rawJob._id,
            JobTitle: job.title,
            ApplicationURL: `${auto1GroupConfig.baseUrl}${job.url}`,
            Location: `${job.locationCity}, ${job.locationCountry}`,
            Company: job.brand || "AUTO1 Group",
            Department: job.department || "N/A",
            ExperienceLevel: job.experienceLevel || "N/A",
            PostedDate: job.createdOn ? job.createdOn.split('T')[0] : "N/A",
            Description: StripHtml(description), 
            ContractType: "N/A",
            Compensation: "N/A",
            ExpirationDate: "N/A",
        };
    },

    filterKeywords: COMMON_KEYWORDS,
};