import { StripHtml, COMMON_KEYWORDS } from '../utils.js';
import { createLocationPreFilter } from "../core/Locationprefilters.js";

export const lidlDeConfig = {
    siteName: 'Lidl DE',
    baseUrl: 'https://jobs.lidl.de',
    apiUrl: 'https://jobs.lidl.de/search_api/jobsearch',
    method: 'GET',
    needsDescriptionScraping: false,
    filterKeywords: [...COMMON_KEYWORDS],
    limit: 15,

    buildPageUrl: (offset, limit, filterKeywords) => {
        const page = Math.floor(offset / limit) + 1;
        const params = new URLSearchParams({
            term: filterKeywords.join(' '),
            page: page,
            filter: JSON.stringify({ contract_type: [], employment_area: [], entry_level: [] }),
            with_event: 'true',
            sort_field: 'postedTs',
            sort_order: 'desc'
        });
        return `${lidlDeConfig.apiUrl}?${params.toString()}`;
    },

    getJobs: (data) => data?.result?.hits || [],
    getTotal: (data) => data?.result?.count || 0,

    // Raw job has 'location.city' and 'location.country'
    preFilter: (rawJob) => {
        const locationText = `${rawJob.location?.city || ""} ${rawJob.location?.country || ""}`;
        return createLocationPreFilter({ locationFields: [] })({ location: locationText });
    },

    mapper: (rawJob) => {
        const location = rawJob.location || {};
        return {
            JobID: String(rawJob.jobId),
            JobTitle: rawJob.title || "",
            Description: StripHtml(rawJob.descResponsibilities || ""),
            ApplicationURL: `${lidlDeConfig.baseUrl}${rawJob.url}`,
            Location: [location.address, location.city, location.postcode, location.country]
                .filter(Boolean).join(', '),
            ContractType: rawJob.contractType || "N/A",
            ExperienceLevel: rawJob.entryLevel || "N/A",
            Department: rawJob.employmentAreaTitle || "N/A",
            Compensation: rawJob.salaryValue || "N/A",
            ExpirationDate: rawJob.onlineUntil || rawJob.closingDate || null,
            PostedDate: rawJob.postedTs ? new Date(rawJob.postedTs * 1000).toISOString() : null,
        };
    },
};