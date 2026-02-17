import { StripHtml, COMMON_KEYWORDS } from "../utils.js";
import { createLocationPreFilter } from "../core/Locationprefilters.js";
import fetch from 'node-fetch';

export const infineonConfig = {
    siteName: "Infineon",
    apiUrl: "https://jobs.infineon.com/api/pcsx/search",
    method: "GET",
    needsDescriptionScraping: true,
    filterKeywords: [...COMMON_KEYWORDS],

    getBody: () => null,

    buildPageUrl: (offset, limit) => {
        const params = new URLSearchParams({
            domain: 'infineon.com',
            query: "",
            location: 'Germany',
            start: offset,
            num: limit,
            sort_by: 'timestamp'
        });
        return `${infineonConfig.apiUrl}?${params.toString()}`;
    },

    getJobs: (data) => data?.data?.positions || [],
    getTotal: (data) => data?.data?.count || 0,

    // Raw job has 'locations' array e.g. ["Munich, Germany", "Neubiberg, Germany"]
    preFilter: (rawJob) => {
        const locationText = (rawJob.locations || []).join(' ');
        return createLocationPreFilter({ locationFields: [] })({ location: locationText });
    },

    getDetails: async (rawJob) => {
        const detailsApiUrl = `https://jobs.infineon.com/api/pcsx/position_details?position_id=${rawJob.id}&domain=infineon.com&hl=en`;
        try {
            const res = await fetch(detailsApiUrl);
            if (!res.ok) { console.error(`[Infineon] Details API failed for job ${rawJob.id}`); return {}; }
            const data = await res.json();
            const detailedJob = data?.data;
            if (!detailedJob) return {};
            return {
                Description: StripHtml(detailedJob.jobDescription || ""),
                ContractType: detailedJob.efcustomTextTypeOfEmployment?.[0] || "N/A",
                ExperienceLevel: detailedJob.efcustomTextJoinAs?.[0] || "N/A"
            };
        } catch (error) {
            console.error(`[Infineon] Error fetching details for job ${rawJob.id}: ${error.message}`);
            return {};
        }
    },

    mapper: (job) => ({
        JobTitle: StripHtml(job.name || ""),
        JobID: String(job.id || ""),
        Location: (job.locations || []).join(' | '),
        PostingDate: job.postedTs ? new Date(job.postedTs * 1000).toISOString().split('T')[0] : "",
        ExpirationDate: "",
        Department: job.department || "N/A",
        Description: "",
        ApplicationURL: `https://jobs.infineon.com${job.positionUrl}`,
        ContractType: "N/A",
        ExperienceLevel: "N/A",
        Compensation: "N/A"
    }),
};