import { StripHtml, COMMON_KEYWORDS } from "../utils.js"


export const tradeRepublicConfig =  {
    siteName: "Trade Republic",
    apiUrl: "https://api.traderepublic.com/api/v1/career/jobs?content=true",
    method: "GET",
    filterKeywords: [...COMMON_KEYWORDS,], // We can add extra keywords like this
    getBody: () => null,
    getJobs: (data) => data?.jobs || [],
    mapper: (job) => ({
      JobTitle: job.title || "",
      JobID: job.id ? String(job.id) : "",
      Location: job.location?.name || "N/A",
      PostingDate: job.updated_at || "",
      Department: job.departments?.[0]?.name || "N/A",
      Description: StripHtml(job.content || ""),
      ApplicationURL: job.absolute_url || "",
      ContractType: "N/A",
      ExperienceLevel: "N/A"
    })
  }