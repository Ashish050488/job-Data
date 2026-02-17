import { StripHtml, COMMON_KEYWORDS } from '../utils.js';
import { createLocationPreFilter } from "../core/Locationprefilters.js";

export const sixtConfig = {
    siteName: 'Sixt',
    baseUrl: 'https://www.sixt.jobs',
    apiUrl: 'https://www.sixt.jobs/uk/jobs',
    method: 'POST',
    needsSession: true,
    needsDescriptionScraping: true,
    descriptionSelector: '#detailPageBody .py-xl',
    filterKeywords: [...COMMON_KEYWORDS],

    getBody: (offset, limit, filterKeywords) => ({
        q: filterKeywords.join(' '),
        search: filterKeywords.join(' '),
        country: "DE",
        page: 1,
        limit: 500
    }),

    getJobs: (data) => data || [],
    getTotal: (data) => (data || []).length,

    // Raw job has 'city' and 'country' fields
    preFilter: createLocationPreFilter({
        locationFields: ['city', 'country']
    }),

    mapper: (job) => ({
        JobID: job.slug || "",
        JobTitle: job.title || "",
        ApplicationURL: `${sixtConfig.baseUrl}${job.url}`,
        Location: `${job.city || ""}, ${job.country || ""}`.replace(/^, /, ""),
        Department: job.role || "N/A",
        ExperienceLevel: job.level || "N/A",
        ContractType: job.type_of_employment || "N/A",
        PostedDate: job.released_date ? job.released_date.split('T')[0] : "N/A",
        ExpirationDate: "N/A",
        Description: "",
        Company: "Sixt",
        Compensation: "N/A",
    }),
};