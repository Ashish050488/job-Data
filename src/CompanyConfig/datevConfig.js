import { StripHtml, COMMON_KEYWORDS } from "../utils.js"


export const datevConfig=  {
    siteName: "DATEV",
    apiUrl: "https://www.datev.de/web/de/karriere/technisches/karriere-json.json",
    method: "GET",
    needsDescriptionScraping: true,
    descriptionSelector: 'div.details-inner',
    locationSelector: 'h1',
    filterKeywords: COMMON_KEYWORDS,
    getBody: () => null,
    getJobs: (data) => data?.jobs || [],
    mapper: (job) => ({
      JobTitle: job.job_title || "",
      JobID: job.reference_id || "",
      Location: "",
      PostingDate: job.publishing_date || "",
      Department: job.business_unit?.name || "N/A",
      Description: "",
      ApplicationURL: `https://www.datev.de${job.fs_url || ""}`,
      ContractType: job.contract_type?.name || "N/A",
      ExperienceLevel: job.experience_level?.name || "N/A",
    })
  }