import { StripHtml, COMMON_KEYWORDS } from "../utils.js";
import { createLocationPreFilter } from "../core/Locationprefilters.js";

export const aldiSudConfig = {
    siteName: 'ALDI SÜD',
    baseUrl: 'https://aldi-sued-holding-careers.com',
    apiUrl: 'https://aldi-sued-holding-careers.com/rest/jobs/search',
    method: 'GET',
    needsDescriptionScraping: true,
    descriptionSelector: '.description',
    filterKeywords: [...COMMON_KEYWORDS],

    buildPageUrl: () => {
        const params = new URLSearchParams({ job_language: 'en_US' });
        return `${aldiSudConfig.apiUrl}?${params.toString()}`;
    },

    getJobs: (data) => data?.jobs || [],
    getTotal: (data) => (data?.jobs || []).length,

    // Raw job has 'city' and 'country_name' fields
    preFilter: createLocationPreFilter({
        locationFields: ['city', 'country_name']
    }),

    mapper: (rawJob) => ({
        JobID: String(rawJob.job_id),
        JobTitle: rawJob.title || "",
        Department: rawJob.area_of_activity_title || "N/A",
        ExperienceLevel: rawJob.career_level_title || "N/A",
        Location: [rawJob.address, rawJob.zip, rawJob.city].filter(Boolean).join(', '),
        ApplicationURL: `${aldiSudConfig.baseUrl}/${rawJob.url}`,
        Description: "",
        ContractType: "N/A",
        Compensation: "N/A",
        PostedDate: "N/A",
        ExpirationDate: "N/A",
    }),
};