import { StripHtml, COMMON_KEYWORDS } from '../utils.js';
import { createLocationPreFilter } from "../core/Locationprefilters.js";

export const auto1GroupConfig = {
    siteName: 'AUTO1 Group',
    baseUrl: 'https://www.auto1-group.com/jobs/',
    apiUrl: 'https://www.auto1-group.com/smart-recruiters/jobs/search/',
    method: 'POST',
    needsDescriptionScraping: true,
    descriptionSelector: '[itemprop="description"]',
    filterKeywords: [...COMMON_KEYWORDS],
    limit: 15,

    getBody: (offset, limit, filterKeywords) => {
        const currentPage = Math.floor(offset / limit) + 1;
        return {
            query: filterKeywords.join(' '),
            filters: { country: "Germany" },
            options: { currentPage, resultsPerPage: limit }
        };
    },

    getJobs: (data) => data?.jobs?.hits || [],
    getTotal: (data) => data?.jobs?.total?.value || 0,

    // Raw job is wrapped in _source, location is in _source.locationCity / _source.locationCountry
    preFilter: (rawJob) => {
        const job = rawJob._source || rawJob;
        const locationText = `${job.locationCity || ""} ${job.locationCountry || ""}`;
        return createLocationPreFilter({ locationFields: [] })({ location: locationText });
    },

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
            JobID: rawJob._id || "",
            JobTitle: job.title || "",
            ApplicationURL: `${auto1GroupConfig.baseUrl}${job.url}`,
            Location: `${job.locationCity || ""}, ${job.locationCountry || ""}`.replace(/^, /, ""),
            Company: job.brand || "AUTO1 Group",
            Department: job.department || "N/A",
            ExperienceLevel: job.experienceLevel || "N/A",
            PostedDate: job.createdOn ? job.createdOn.split('T')[0] : "N/A",
            ExpirationDate: "N/A",
            Description: StripHtml(description),
            ContractType: "N/A",
            Compensation: "N/A",
        };
    },
};