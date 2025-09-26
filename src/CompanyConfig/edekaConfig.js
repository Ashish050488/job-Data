import { COMMON_KEYWORDS } from '../utils.js';

export const edekaConfig = {
    siteName: 'EDEKA',
    baseUrl: 'https://verbund.edeka',
    apiUrl: 'https://verbund.edeka/api/v2/career/vacancies',
    method: 'GET',

    needsDescriptionScraping: true,
    descriptionSelector: '.o-m201-job-copy',
    
    // ✅ FIX: This preFilter ensures we only process jobs that have a 5-digit German postal code.
    preFilter: (rawJob) => {
        return rawJob.locationZipCode && /^\d{5}$/.test(rawJob.locationZipCode);
    },

    buildPageUrl: (offset, limit, filterKeywords) => {
        const page = Math.floor(offset / limit);
        const searchTerm = filterKeywords.join(' ');

        const params = new URLSearchParams({
            query: searchTerm,
            page: page,
            size: limit,
        });

        return `${edekaConfig.apiUrl}?${params.toString()}`;
    },

    getJobs: (data) => data?.entries || [],
    getTotal: (data) => data?.totalCount || 0,
    limit: 20,

    mapper: (rawJob) => {
        const jobID = `${rawJob.vacancyId}-${rawJob.locationId}`;
        const locationParts = [rawJob.locationStreet, rawJob.locationZipCode, rawJob.locationCity];
        const location = locationParts.filter(part => part && part.trim()).join(', ');

        return {
            JobID: jobID,
            JobTitle: rawJob.title,
            ApplicationURL: rawJob.detailPageUrl,
            Location: location,
            Company: rawJob.companyName || "N/A",
            Description: "",
            Department: "N/A",
            ExperienceLevel: "N/A",
            ContractType: "N/A",
            Compensation: "N/A",
            PostedDate: "N/A",
            ExpirationDate: "N/A",
        };
    },

    filterKeywords: COMMON_KEYWORDS,
};