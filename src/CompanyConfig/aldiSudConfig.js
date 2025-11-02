import { COMMON_KEYWORDS } from '../utils.js';

export const aldiSudConfig = {
    siteName: 'ALDI SÜD',
    baseUrl: 'https://aldi-sued-holding-careers.com',
    apiUrl: 'https://aldi-sued-holding-careers.com/rest/jobs/search',
    method: 'GET',
    
    buildPageUrl: () => {
        const params = new URLSearchParams({ job_language: 'en_US' });
        return `${aldiSudConfig.apiUrl}?${params.toString()}`;
    },

    getJobs: (data) => data.jobs || [],
    getTotal: (data) => (data.jobs || []).length,
    
    // This tells the new processor to run the scraping logic
    needsDescriptionScraping: true,
    descriptionSelector: '.description',

    mapper: (rawJob) => {
        return {
            JobID: String(rawJob.job_id),
            JobTitle: rawJob.title,
            Department: rawJob.area_of_activity_title || "N/A",
            ExperienceLevel: rawJob.career_level_title || "N/A",
            Location: `${rawJob.address}, ${rawJob.zip} ${rawJob.city}`,
            ApplicationURL: `${aldiSudConfig.baseUrl}/${rawJob.url}`,
            
            // --- Placeholders to be filled by the new processor function ---
            Description: "",
            ContractType: "N/A",
            Compensation: "N/A",
            
            // --- Fields not available ---
            PostedDate: "N/A",
            ExpirationDate: "N/A",
        };
    },

    filterKeywords: COMMON_KEYWORDS,
};