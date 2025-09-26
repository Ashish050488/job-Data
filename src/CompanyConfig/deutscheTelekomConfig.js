import { StripHtml, COMMON_KEYWORDS } from "../utils.js"


export const deutscheTelekomConfig=  {
    // The name for our logs and Excel sheet.
    siteName: "Deutsche Telekom",
    // The API URL you discovered, cleaned up to get all jobs in Germany.
    apiUrl: "https://www.telekom.com/service/globaljobsearch/en/558550?countries=393776",
    refererUrl: "https://www.telekom.com/en/careers/jobsearch",
    // It is a GET request.
    method: "GET",
    // This flag tells our main.js engine to perform the second step.
    needsDescriptionScraping: true,
    // This is the unique "address" for the description we just found.
    descriptionSelector: 'div.richtext.raw',
    // The location is in the first API call, so we don't need a real selector for it.
    // We set a placeholder so the script doesn't crash if it looks for one.
    locationSelector: 'h1',
    filterKeywords: [...COMMON_KEYWORDS],
    // A GET request does not have a body.
    getBody: () => null,
    // The list of jobs is inside the 'results.jobs' array in the response.
    getJobs: (data) => data?.results?.jobs || [],

    // This mapper translates the data from the FIRST API call.
    // The Description will be filled in by our second step.
    mapper: (job) => ({
      JobTitle: job.title || "",
      // The API doesn't provide a unique ID, so we will create one from the URL.
      // This takes the last part of the URL (e.g., "233087") to use as an ID.
      JobID: (job.url || "").split('_').pop(),
      // The locations are in a simple array, so we join them.
      Location: (job.locations || []).join(' | '),
      PostingDate: job.date || "",
      Department: job.division || "N/A",
      Description: "", // This will be filled in by the second step.
      // We must build the full URL from the base URL and the partial path.
      ApplicationURL: `https://www.telekom.com${job.url || ""}`,
      ContractType: job.hours || "N/A",
      ExperienceLevel: "N/A", // This is not provided by the API.
      Compensation: "N/A" // This is not provided by the API.
    })
  }