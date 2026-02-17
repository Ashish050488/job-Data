import { StripHtml, COMMON_KEYWORDS } from "../utils.js";
import { createLocationPreFilter } from "../core/Locationprefilters.js";
import fetch from 'node-fetch';

export const almediaConfig = {
    siteName: "Almedia",
    apiUrl: "https://jobs.ashbyhq.com/api/non-user-graphql?op=ApiJobBoardWithTeams",
    method: "POST",
    needsDescriptionScraping: true,
    filterKeywords: [...COMMON_KEYWORDS],

    getBody: () => ({
        operationName: "ApiJobBoardWithTeams",
        variables: { organizationHostedJobsPageName: "almedia" },
        query: "query ApiJobBoardWithTeams($organizationHostedJobsPageName: String!) { jobBoard: jobBoardWithTeams(organizationHostedJobsPageName: $organizationHostedJobsPageName) { teams { id name parentTeamId } jobPostings { id title teamId locationId locationName workplaceType employmentType compensationTierSummary } } }"
    }),

    getJobs: (data) => data?.data?.jobBoard?.jobPostings || [],
    getTotal: (data) => data?.data?.jobBoard?.jobPostings?.length || 0,

    // Raw job has 'locationName' field e.g. "Berlin, Germany" or "Remote (Germany)"
    preFilter: createLocationPreFilter({
        locationFields: ['locationName']
    }),

    getDetails: async (job) => {
        const detailsApiUrl = "https://jobs.ashbyhq.com/api/non-user-graphql?op=ApiJobPosting";
        const detailsPayload = {
            operationName: "ApiJobPosting",
            variables: { organizationHostedJobsPageName: "almedia", jobPostingId: job.id },
            query: 'query ApiJobPosting($organizationHostedJobsPageName: String!, $jobPostingId: String!) { jobPosting(organizationHostedJobsPageName: $organizationHostedJobsPageName, jobPostingId: $jobPostingId) { id title departmentName locationName descriptionHtml employmentType } }'
        };
        try {
            const res = await fetch(detailsApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(detailsPayload)
            });
            if (!res.ok) { console.error(`[Almedia] Details API failed for job ${job.id}`); return {}; }
            const data = await res.json();
            return {
                Description: StripHtml(data?.data?.jobPosting?.descriptionHtml || ""),
                Department: data?.data?.jobPosting?.departmentName || "N/A",
                ContractType: data?.data?.jobPosting?.employmentType || "N/A"
            };
        } catch (error) {
            console.error(`[Almedia] Error fetching details for job ${job.id}: ${error.message}`);
            return {};
        }
    },

    mapper: (job) => ({
        JobTitle: job.title || "",
        JobID: job.id || "",
        Location: job.locationName || "N/A",
        PostingDate: "",
        ExpirationDate: "",
        Department: "",
        Description: "",
        ApplicationURL: `https://jobs.ashbyhq.com/almedia/${job.id}`,
        ContractType: job.employmentType || "",
        ExperienceLevel: "N/A",
        Compensation: job.compensationTierSummary || "N/A",
    })
};