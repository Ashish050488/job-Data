// config.js
import { StripHtml, COMMON_KEYWORDS } from './src/utils.js';
import fetch from 'node-fetch'; // fetch is needed for the getDetails function
import { AbortController } from 'abort-controller';
import { analyzeJobDescription } from './grokAnalyzer.js';



export const SITES_CONFIG = [

  // {
  //   siteName: "Mercedes-Benz",
  //   apiUrl: "https://mercedes-benz-beesite-production-gjb.app.beesite.de/search",
  //   method: "POST",
  //   filterKeywords: [...COMMON_KEYWORDS],
  //   getBody: (offset, limit) => ({
  //     LanguageCode: "EN",
  //     SearchParameters: { FirstItem: offset + 1, CountItem: limit, Sort: [{ Criterion: "PublicationStartDate", Direction: "DESC" }] },
  //     SearchCriteria: [{ CriterionName: "PublicationLanguage.Code", CriterionValue: ["EN"] }, { CriterionName: "PositionLocation.Country", CriterionValue: [329] }]
  //   }),
  //   getJobs: (data) => (data?.SearchResult?.SearchResultItems || []).map(item => item.MatchedObjectDescriptor),
  //   mapper: (job) => ({
  //     JobTitle: StripHtml(job.PositionTitle || ""),
  //     JobID: job.PositionID || job.ID || "",
  //     Location: (job.PositionLocation || []).map(loc => `${loc.CityName || ""}, ${loc.CountryName || ""}`).join(" | "),
  //     PostingDate: String(job.PositionStartDate || job.PublicationStartDate || ""),
  //     Department: job.DepartmentName || job.JobCategory?.[0]?.Name || "",
  //     Description: StripHtml((job.PositionFormattedDescription || []).map(d => [d.Tasks, d.Qualifications, d.AdditionalInformations].join(" ")).join(" ")),
  //     ApplicationURL: String(job.PositionURI || (Array.isArray(job.ApplyURI) ? job.ApplyURI[0] : job.ApplyURI) || ""),
  //     ContractType: job.PositionOfferingType?.[0]?.Name || "",
  //     ExperienceLevel: job.CareerLevel?.[0]?.Name || ""
  //   })
  // },
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
//     },
{
    siteName: "Infineon",
    apiUrl: "https://jobs.infineon.com/api/apply/v2/jobs",
    suggestUrl: "https://jobs.infineon.com/api/suggest",
    method: "GET",

    filterKeywords: [
        "manager", "lead", "director", "head", "principal", "senior",
        "product owner", "program manager", "project manager"
    ],

    customScraper: async function(existingIDsMap) {
        const existingIDs = existingIDsMap.get(this.siteName) || new Set();
        const allNewJobs = [];
        const foundJobIDs = new Set();
        const headers = {
            'accept': 'application/json',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'referer': 'https://jobs.infineon.com'
        };

        // --- Stage 1: Discover Locations ---
        console.log(`[Infineon] Discovering all active German locations...`);
        const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');
        const germanLocations = new Set();
        for (const letter of alphabet) {
            const discoveryParams = new URLSearchParams({ term: letter, dictionary: 'job_location', limit: 100, domain: 'infineon.com' });
            const discoveryUrl = `${this.suggestUrl}?${discoveryParams.toString()}`;
            try {
                const res = await fetch(discoveryUrl, { headers });
                const data = await res.json();
                if (data.suggestions) {
                    data.suggestions.forEach(suggestion => {
                        if (suggestion.term && suggestion.term.endsWith("(Germany)")) {
                            germanLocations.add(suggestion.term);
                        }
                    });
                }
            } catch (e) {}
        }
        console.log(`[Infineon] Discovered ${germanLocations.size} unique locations. Starting full scrape...`);
        
        // --- Stage 2: Fetch and Filter Jobs by Location ---
        for (const location of germanLocations) {
            console.log(`--- [Infineon] Searching location: ${location} ---`);
            let offset = 0;
            const limit = 20;
            let hasMore = true;

            while (hasMore) {
                const params = new URLSearchParams({ hl: 'en', location, start: offset, num: limit });
                const url = `${this.apiUrl}?${params.toString()}`;
                const res = await fetch(url, { headers });
                
                if (!res.ok) { hasMore = false; continue; }

                const data = await res.json();
                const jobs = data?.positions || [];

                if (jobs.length === 0) {
                    hasMore = false;
                    continue;
                }

                for (const rawJob of jobs) {
                    const preliminaryMap = this.mapper(rawJob);
                    const title = preliminaryMap.JobTitle.toLowerCase();
                    const description = preliminaryMap.Description.toLowerCase();
                    const textToSearch = title + ' ' + description;

                    // This filter now only checks for positive keywords.
                    if (this.filterKeywords && this.filterKeywords.length > 0) {
                        const hasPositiveKeyword = this.filterKeywords.some(kw => textToSearch.includes(kw.toLowerCase()));
                        if (!hasPositiveKeyword) continue;
                    }
                    
                    const jobID = preliminaryMap.JobID;
                    if (jobID && !existingIDs.has(jobID) && !foundJobIDs.has(jobID)) {
                        foundJobIDs.add(jobID);
                        let mappedJob = preliminaryMap;
                        
                        if (!rawJob.job_description) {
                           const details = await this.getDetails(rawJob);
                           mappedJob = { ...mappedJob, ...details };
                        }

                        console.log(`[Infineon] New job found: ${mappedJob.JobID}. Analyzing...`);
                        const aiResult = await analyzeJobDescription(mappedJob.Description);
                        const finalJobData = { ...mappedJob, GermanRequired: String(aiResult.germanRequired || "N/A"), Summary: String(aiResult.summary || ""), siteName: this.siteName };
                        allNewJobs.push(finalJobData);
                    }
                }
                offset += 20;
            }
        }
        
        console.log(`[Infineon] Finished. Found ${allNewJobs.length} new jobs.`);
        return allNewJobs;
    },
    
    mapper: (job) => {
        const postingDate = job.t_create ? new Date(job.t_create * 1000).toISOString().split('T')[0] : "";
        return {
            JobTitle: StripHtml(job.name || ""),
            JobID: String(job.id || ""),
            Location: job.location || "N/A",
            PostingDate: postingDate,
            Department: job.department || "N/A",
            Description: StripHtml(job.job_description || ""),
            ApplicationURL: job.canonicalPositionUrl || `https://jobs.infineon.com/careers/job/${job.id}`,
            ContractType: "",
            ExperienceLevel: "N/A",
            Compensation: "N/A",
        };
    },
    getDetails: async (job) => {
        try {
            const detailsApiUrl = `https://jobs.infineon.com/api/apply/v2/jobs/${job.id}?domain=infineon.com`;
            const res = await fetch(detailsApiUrl);
            if (!res.ok) return {};
            const detailedJob = await res.json();
            return {
                Description: StripHtml(detailedJob?.job_description || ""),
                ContractType: detailedJob?.custom_JD?.data_fields?.type_of_employment?.[0] || "N/A"
            };
        } catch (e) {
            return {};
        }
    }
}
  
  ];
