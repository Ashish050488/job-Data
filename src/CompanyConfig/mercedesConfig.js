import { StripHtml, COMMON_KEYWORDS } from "../utils.js"


export const mercedesConfig={
    siteName: "Mercedes-Benz",
    apiUrl: "https://mercedes-benz-beesite-production-gjb.app.beesite.de/search",
    method: "POST",

    // This is the list of keywords your scraper engine will use to filter the results.
    filterKeywords: [
        "project manager", "program manager", "product manager", "product owner",
        "lead", "team lead", "tech lead", "engineering manager",
        "head of", "director", "chief", "vp", "vice president",
        "principal", "senior"
    ],

    // This function is now simplified to fetch ALL jobs in Germany.
    // The scraper engine will handle the keyword filtering.
    getBody: (offset, limit) => ({
        LanguageCode: "EN",
        SearchParameters: {
            FirstItem: offset + 1,
            CountItem: limit,
            Sort: [{ Criterion: "PublicationStartDate", Direction: "DESC" }]
        },
        SearchCriteria: [
            { CriterionName: "PublicationLanguage.Code", CriterionValue: ["EN"] },
            { CriterionName: "PositionLocation.Country", CriterionValue: [329] }
        ]
    }),

    // This helps the engine's pagination logic work correctly.
    getTotal: (data) => data?.SearchResult?.SearchResultCountAll || 0,
    
    getJobs: (data) => (data?.SearchResult?.SearchResultItems || []).map(item => item.MatchedObjectDescriptor),
    
    mapper: (job) => ({
        JobTitle: StripHtml(job.PositionTitle || ""),
        JobID: String(job.ID || job.PositionID || ""), // Use the unique ID
        Location: (job.PositionLocation || []).map(loc => `${loc.CityName || ""}, ${loc.CountryName || ""}`).join(" | "),
        PostingDate: String(job.PositionStartDate || job.PublicationStartDate || ""),
        Department: job.DepartmentName || job.JobCategory?.[0]?.Name || "",
        Description: StripHtml((job.PositionFormattedDescription || []).map(d => [d.Tasks, d.Qualifications, d.AdditionalInformations].join(" ")).join(" ")),
        ApplicationURL: String(job.PositionURI || (Array.isArray(job.ApplyURI) ? job.ApplyURI[0] : job.ApplyURI) || ""),
        ContractType: job.PositionOfferingType?.[0]?.Name || "",
        ExperienceLevel: job.CareerLevel?.[0]?.Name || ""
    })
}