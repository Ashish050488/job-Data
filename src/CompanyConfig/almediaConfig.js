import { StripHtml, COMMON_KEYWORDS } from "../utils.js";
import fetch from 'node-fetch'; // Required for the getDetails function

export const almediaConfig = {
    siteName: "Almedia",
    apiUrl: "https://jobs.ashbyhq.com/api/non-user-graphql?op=ApiJobBoardWithTeams",
    method: "POST",
    needsDescriptionScraping: true,
    filterKeywords: [...COMMON_KEYWORDS,],
    locationFilter: "Germany",
    
    getBody: (offset, limit, keywords, location) => {
        const operationName = "ApiJobBoardWithTeams";
        let variables = { organizationHostedJobsPageName: "almedia" };
        let query;
        if (location) {
            variables.location = location;
            query = "query ApiJobBoardWithTeams($organizationHostedJobsPageName: String!, $location: String) { jobBoard: jobBoardWithTeams(organizationHostedJobsPageName: $organizationHostedJobsPageName) { teams { id name parentTeamId } jobPostings(location: $location) { id title teamId locationId locationName workplaceType employmentType compensationTierSummary } } }";
        } else {
            query = "query ApiJobBoardWithTeams($organizationHostedJobsPageName: String!) { jobBoard: jobBoardWithTeams(organizationHostedJobsPageName: $organizationHostedJobsPageName) { teams { id name parentTeamId } jobPostings { id title teamId locationId locationName workplaceType employmentType compensationTierSummary } } }";
        }
        return { operationName, variables, query };
    },

    getJobs: (data) => data?.data?.jobBoard?.jobPostings || [],
    
    // ✅ FIX 1: This function stops the infinite loop.
    // It tells the scraper engine the total number of jobs by counting the array length.
    getTotal: (data) => data?.data?.jobBoard?.jobPostings?.length || 0,

    // ✅ FIX 2: Corrected the 'getDetails' function to accept the full 'job' object.
    getDetails: async (job) => {
        const jobId = job.id; // Extract the ID from the job object
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