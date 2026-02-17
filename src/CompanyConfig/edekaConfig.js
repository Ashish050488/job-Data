import { StripHtml, COMMON_KEYWORDS } from '../utils.js';
import { createLocationPreFilter } from "../core/Locationprefilters.js";

export const edekaConfig = {
    siteName: 'EDEKA',
    baseUrl: 'https://verbund.edeka',
    apiUrl: 'https://verbund.edeka/api/v2/career/vacancies',
    method: 'GET',
    needsDescriptionScraping: true,
    descriptionSelector: '.o-m201-job-copy',
    filterKeywords: [...COMMON_KEYWORDS],
    limit: 20,

    buildPageUrl: (offset, limit, filterKeywords) => {
        const page = Math.floor(offset / limit);
        const params = new URLSearchParams({
            query: filterKeywords.join(' '),
            page: page,
            size: limit,
        });
        return `${edekaConfig.apiUrl}?${params.toString()}`;
    },

    getJobs: (data) => data?.entries || [],
    getTotal: (data) => data?.totalCount || 0,

    // Raw job has 'locationCity' and 'locationZipCode' (5-digit = Germany)
    preFilter: (rawJob) => {
        // German postal codes are always 5 digits — reliable Germany check
        if (rawJob.locationZipCode && /^\d{5}$/.test(rawJob.locationZipCode)) return true;
        return createLocationPreFilter({ locationFields: ['locationCity'] })(rawJob);
    },

    mapper: (rawJob) => ({
        JobID: `${rawJob.vacancyId}-${rawJob.locationId}`,
        JobTitle: rawJob.title || "",
        ApplicationURL: rawJob.detailPageUrl || "",
        Location: [rawJob.locationStreet, rawJob.locationZipCode, rawJob.locationCity]
            .filter(Boolean).join(', '),
        Company: rawJob.companyName || "EDEKA",
        Description: "",
        Department: "N/A",
        ExperienceLevel: "N/A",
        ContractType: "N/A",
        Compensation: "N/A",
        PostedDate: "N/A",
        ExpirationDate: "N/A",
    }),
};