import { StripHtml, COMMON_KEYWORDS } from "../utils.js";
import fetch from 'node-fetch';

export const almediaConfig = {
    siteName: "Almedia",
    apiUrl: "https://jobs.ashbyhq.com/api/non-user-graphql?op=ApiJobBoardWithTeams",
    method: "POST",
    needsDescriptionScraping: true,
    filterKeywords: [...COMMON_KEYWORDS,],
    
    /**
     * ✅ FIX 1: This function now ONLY fetches all jobs.
     * The location filtering is handled by the new preFilter function below.
     */
    getBody: (offset, limit, keywords, location) => {
        return {
            operationName: "ApiJobBoardWithTeams",
            variables: { organizationHostedJobsPageName: "almedia" },
            query: "query ApiJobBoardWithTeams($organizationHostedJobsPageName: String!) { jobBoard: jobBoardWithTeams(organizationHostedJobsPageName: $organizationHostedJobsPageName) { teams { id name parentTeamId } jobPostings { id title teamId locationId locationName workplaceType employmentType compensationTierSummary } } }"
        };
    },
    
    /**
     * ✅ FIX 2: Added a preFilter to check the location AFTER fetching.
     * This will only keep jobs where the location is "Berlin".
     */
    preFilter: (job) => {
        return job.locationName?.toLowerCase() === 'berlin';
    },

    getJobs: (data) => data?.data?.jobBoard?.jobPostings || [],
    
    getTotal: (data) => data?.data?.jobBoard?.jobPostings?.length || 0,

    getDetails: async (job) => {
        const jobId = job.id;
        const detailsApiUrl = "https://jobs.ashbyhq.com/api/non-user-graphql?op=ApiJobPosting";
        const detailsPayload = {
            operationName: "ApiJobPosting",
            variables: { organizationHostedJobsPageName: "almedia", jobPostingId: jobId },
            query: 'query ApiJobPosting($organizationHostedJobsPageName: String!, $jobPostingId: String!) { jobPosting(organizationHostedJobsPageName: $organizationHostedJobsPageName, jobPostingId: $jobPostingId) { id title departmentName locationName descriptionHtml employmentType } }'
        };
        const res = await fetch(detailsApiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(detailsPayload) });
        if (!res.ok) { console.error(`Almedia details API failed for job ${jobId}`); return {}; }
        const data = await res.json();
        const description = data?.data?.jobPosting?.descriptionHtml || "";
        return {
            Description: StripHtml(description),
            Department: data?.data?.jobPosting?.departmentName || "N/A",
            ContractType: data?.data?.jobPosting?.employmentType || "N/A"
        };
    },

    mapper: (job) => ({
        JobTitle: job.title || "",
        JobID: job.id || "",
        Location: job.locationName || "N/A",
        PostingDate: "",
        Department: "",
        Description: "",
        ApplicationURL: `https://jobs.ashbyhq.com/almedia/${job.id}`,
        ContractType: job.employmentType || "",
        ExperienceLevel: "N/A",
        Compensation: job.compensationTierSummary || "N/A",
    })
};