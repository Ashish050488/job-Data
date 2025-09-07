// config.js
import { StripHtml, COMMON_KEYWORDS } from './src/utils.js';
import dotenv from "dotenv"
dotenv.config();
import fetch from 'node-fetch'; // fetch is needed for the getDetails function

export const GROQ_API_KEY = process.env.GROQ_API_KEY;

export const SITES_CONFIG = [

  {
    siteName: "Mercedes-Benz",
    apiUrl: "https://mercedes-benz-beesite-production-gjb.app.beesite.de/search",
    method: "POST",
    filterKeywords: [...COMMON_KEYWORDS],
    getBody: (offset, limit) => ({
      LanguageCode: "EN",
      SearchParameters: { FirstItem: offset + 1, CountItem: limit, Sort: [{ Criterion: "PublicationStartDate", Direction: "DESC" }] },
      SearchCriteria: [{ CriterionName: "PublicationLanguage.Code", CriterionValue: ["EN"] }, { CriterionName: "PositionLocation.Country", CriterionValue: [329] }]
    }),
    getJobs: (data) => (data?.SearchResult?.SearchResultItems || []).map(item => item.MatchedObjectDescriptor),
    mapper: (job) => ({
      JobTitle: StripHtml(job.PositionTitle || ""),
      JobID: job.PositionID || job.ID || "",
      Location: (job.PositionLocation || []).map(loc => `${loc.CityName || ""}, ${loc.CountryName || ""}`).join(" | "),
      PostingDate: String(job.PositionStartDate || job.PublicationStartDate || ""),
      Department: job.DepartmentName || job.JobCategory?.[0]?.Name || "",
      Description: StripHtml((job.PositionFormattedDescription || []).map(d => [d.Tasks, d.Qualifications, d.AdditionalInformations].join(" ")).join(" ")),
      ApplicationURL: String(job.PositionURI || (Array.isArray(job.ApplyURI) ? job.ApplyURI[0] : job.ApplyURI) || ""),
      ContractType: job.PositionOfferingType?.[0]?.Name || "",
      ExperienceLevel: job.CareerLevel?.[0]?.Name || ""
    })
  },
  // {
  //   siteName: "DATEV",
  //   apiUrl: "https://www.datev.de/web/de/karriere/technisches/karriere-json.json",
  //   method: "GET",
  //   needsDescriptionScraping: true,
  //   descriptionSelector: 'div.details-inner',
  //   locationSelector: 'h1',
  //   filterKeywords: COMMON_KEYWORDS,
  //   getBody: () => null,
  //   getJobs: (data) => data?.jobs || [],
  //   mapper: (job) => ({
  //     JobTitle: job.job_title || "",
  //     JobID: job.reference_id || "",
  //     Location: "",
  //     PostingDate: job.publishing_date || "",
  //     Department: job.business_unit?.name || "N/A",
  //     Description: "",
  //     ApplicationURL: `https://www.datev.de${job.fs_url || ""}`,
  //     ContractType: job.contract_type?.name || "N/A",
  //     ExperienceLevel: job.experience_level?.name || "N/A",
  //   })
  // },
  // {
  //   siteName: "Trade Republic",
  //   apiUrl: "https://api.traderepublic.com/api/v1/career/jobs?content=true",
  //   method: "GET",
  //   filterKeywords: [...COMMON_KEYWORDS,], // We can add extra keywords like this
  //   getBody: () => null,
  //   getJobs: (data) => data?.jobs || [],
  //   mapper: (job) => ({
  //     JobTitle: job.title || "",
  //     JobID: job.id ? String(job.id) : "",
  //     Location: job.location?.name || "N/A",
  //     PostingDate: job.updated_at || "",
  //     Department: job.departments?.[0]?.name || "N/A",
  //     Description: StripHtml(job.content || ""),
  //     ApplicationURL: job.absolute_url || "",
  //     ContractType: "N/A",
  //     ExperienceLevel: "N/A"
  //   })
  // },
  // {
  //   siteName: "Almedia",
  //   apiUrl: "https://jobs.ashbyhq.com/api/non-user-graphql?op=ApiJobBoardWithTeams",
  //   method: "POST",
  //   needsDescriptionScraping: true,
  //   filterKeywords: [...COMMON_KEYWORDS,],
  //   locationFilter: "Germany",
  //   getBody: (offset, limit, keywords, location) => {
  //     const operationName = "ApiJobBoardWithTeams";
  //     let variables = { organizationHostedJobsPageName: "almedia" };
  //     let query;
  //     if (location) {
  //       variables.location = location;
  //       query = "query ApiJobBoardWithTeams($organizationHostedJobsPageName: String!, $location: String) { jobBoard: jobBoardWithTeams(organizationHostedJobsPageName: $organizationHostedJobsPageName) { teams { id name parentTeamId } jobPostings(location: $location) { id title teamId locationId locationName workplaceType employmentType compensationTierSummary } } }";
  //     } else {
  //       query = "query ApiJobBoardWithTeams($organizationHostedJobsPageName: String!) { jobBoard: jobBoardWithTeams(organizationHostedJobsPageName: $organizationHostedJobsPageName) { teams { id name parentTeamId } jobPostings { id title teamId locationId locationName workplaceType employmentType compensationTierSummary } } }";
  //     }
  //     return { operationName, variables, query };
  //   },
  //   getJobs: (data) => data?.data?.jobBoard?.jobPostings || [],
  //   getDetails: async (jobId) => {
  //     const detailsApiUrl = "https://jobs.ashbyhq.com/api/non-user-graphql?op=ApiJobPosting";
  //     const detailsPayload = {
  //       operationName: "ApiJobPosting",
  //       variables: { organizationHostedJobsPageName: "almedia", jobPostingId: jobId },
  //       query: 'query ApiJobPosting($organizationHostedJobsPageName: String!, $jobPostingId: String!) { jobPosting(organizationHostedJobsPageName: $organizationHostedJobsPageName, jobPostingId: $jobPostingId) { id title departmentName locationName descriptionHtml employmentType } }'
  //     };
  //     const res = await fetch(detailsApiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(detailsPayload) });
  //     if (!res.ok) { console.error(`Almedia details API failed for job ${jobId}`); return {}; }
  //     const data = await res.json();
  //     const description = data?.data?.jobPosting?.descriptionHtml || "";
  //     return {
  //       Description: StripHtml(description),
  //       Department: data?.data?.jobPosting?.departmentName || "N/A",
  //       ContractType: data?.data?.jobPosting?.employmentType || "N/A"
  //     };
  //   },
  //   mapper: (job) => ({
  //     JobTitle: job.title || "",
  //     JobID: job.id || "",
  //     Location: job.locationName || "N/A",
  //     PostingDate: "",
  //     Department: "",
  //     Description: "",
  //     ApplicationURL: `https://jobs.ashbyhq.com/almedia/${job.id}`,
  //     ContractType: job.employmentType || "",
  //     ExperienceLevel: "N/A",
  //     Compensation: job.compensationTierSummary || "N/A",
  //   })
  // },

  // {
  //   siteName: "Redcare Pharmacy",
  //   apiUrl: "https://www.redcare-pharmacy.com/api/get-job-posting?locale=en&loadAll=true",
  //   method: "GET",
  //   needsDescriptionScraping: true,
  //   filterKeywords: [...COMMON_KEYWORDS,],
  //   getBody: () => null,
  //   getJobs: (data) => data?.items || [],
  //   getDetails: async (jobId) => {
  //     const detailsApiUrl = `https://api.smartrecruiters.com/v1/companies/Redcare-Pharmacy/postings/${jobId}`;
  //     const res = await fetch(detailsApiUrl);
  //     if (!res.ok) {
  //       console.log(`Redcare details API failed for ${jobId}`);
  //       return {};
  //     }
  //     const data = await res.json();
  //     const sections = data?.jobAd?.sections;
  //     const description = [
  //       sections?.companyDescription?.text,
  //       sections?.jobDescription?.text,
  //       sections?.qualifications?.text,
  //       sections?.additionalInformation?.text,
  //     ].join(" ");
  //     return {
  //       Description: StripHtml(description)
  //     };
  //   },
  //   mapper: (job) => ({
  //     JobTitle: job.name || "",
  //     JobID: job.id || "",
  //     Location: job.location?.fullLocation || "",
  //     PostingDate: job.releasedDate || "",
  //     Description: "",
  //     Department: job.department?.label || "N/A",
  //     ApplicationURL: `https://www.redcare-pharmacy.com/career/${job.id}`,
  //     ContractType: job.typeOfEmployment?.label || "N/A",
  //     // ✅ FIX: Corrected spelling from ExperienceLavel to ExperienceLevel
  //     ExperienceLevel: job.experienceLevel?.label || "N/A",
  //     Compensation: "N/A"
  //   })
  // },
  // // Add this new object to the end of your SITES_CONFIG array in config.js
  // {
  //   // The name for our logs and Excel sheet.
  //   siteName: "Deutsche Telekom",
  //   // The API URL you discovered, cleaned up to get all jobs in Germany.
  //   apiUrl: "https://www.telekom.com/service/globaljobsearch/en/558550?countries=393776",
  //   refererUrl: "https://www.telekom.com/en/careers/jobsearch",
  //   // It is a GET request.
  //   method: "GET",
  //   // This flag tells our main.js engine to perform the second step.
  //   needsDescriptionScraping: true,
  //   // This is the unique "address" for the description we just found.
  //   descriptionSelector: 'div.richtext.raw',
  //   // The location is in the first API call, so we don't need a real selector for it.
  //   // We set a placeholder so the script doesn't crash if it looks for one.
  //   locationSelector: 'h1',
  //   filterKeywords: [...COMMON_KEYWORDS],
  //   // A GET request does not have a body.
  //   getBody: () => null,
  //   // The list of jobs is inside the 'results.jobs' array in the response.
  //   getJobs: (data) => data?.results?.jobs || [],

  //   // This mapper translates the data from the FIRST API call.
  //   // The Description will be filled in by our second step.
  //   mapper: (job) => ({
  //     JobTitle: job.title || "",
  //     // The API doesn't provide a unique ID, so we will create one from the URL.
  //     // This takes the last part of the URL (e.g., "233087") to use as an ID.
  //     JobID: (job.url || "").split('_').pop(),
  //     // The locations are in a simple array, so we join them.
  //     Location: (job.locations || []).join(' | '),
  //     PostingDate: job.date || "",
  //     Department: job.division || "N/A",
  //     Description: "", // This will be filled in by the second step.
  //     // We must build the full URL from the base URL and the partial path.
  //     ApplicationURL: `https://www.telekom.com${job.url || ""}`,
  //     ContractType: job.hours || "N/A",
  //     ExperienceLevel: "N/A", // This is not provided by the API.
  //     Compensation: "N/A" // This is not provided by the API.
  //   })
  // },
// {
//         siteName: "Airbus",
//         apiUrl: "https://ag.wd3.myworkdayjobs.com/wday/cxs/ag/Airbus/jobs",
//         baseUrl: "https://ag.wd3.myworkdayjobs.com/Airbus",
//         method: "POST",
//         needsSession: true,
//         needsDescriptionScraping: true,
//         filterKeywords: [...COMMON_KEYWORDS],
//         getBody: (offset, limit, keywords) => ({
//             "appliedFacets": { "locationCountry": ["dcc5b7608d8644b3a93716604e78e995"] },
//             "limit": 20,
//             "offset": offset,
//             "searchText": ""
//         }),
//         getJobs: (data) => data?.jobPostings || [],
//         getDetails: async (job, sessionHeaders) => {
//             const detailsApiUrl = `https://ag.wd3.myworkdayjobs.com/wday/cxs/ag/Airbus${job.externalPath}`;
//             const res = await fetch(detailsApiUrl, { headers: sessionHeaders });
//             if (!res.ok) { return {}; }
//             const data = await res.json();
//             const jobInfo = data?.jobPostingInfo;
//             if (jobInfo?.jobRequisitionLocation?.country?.descriptor !== "Germany") { return { skip: true }; }
//             return {
//                 Description: StripHtml(jobInfo?.jobDescription || ""),
//                 Department: jobInfo?.jobRequisitionLocation?.descriptor || "N/A",
//                 ContractType: jobInfo?.timeType || "N/A",
//                 Location: jobInfo?.location || jobInfo?.jobRequisitionLocation?.descriptor || "N/A"
//             };
//         },
//         // ✅ THE FINAL FIX: The complete, correct mapper is now included.
//         mapper: (job) => ({
//             JobTitle: job.title || "",
//             JobID: job.bulletFields?.[0] || "",
//             Location: job.locationsText || "",
//             PostingDate: job.postedOn || "",
//             Department: "",
//             Description: "",
//             ApplicationURL: `https://ag.wd3.myworkdayjobs.com/wday/cxs/ag/Airbus${job.externalPath}`,
//             ContractType: "",
//             ExperienceLevel: "N/A",
//             Compensation: "N/A"
//         })
//     }
  
  ];
