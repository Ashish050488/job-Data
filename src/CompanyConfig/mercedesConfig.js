import { StripHtml, COMMON_KEYWORDS } from "../utils.js";
import { createLocationPreFilter } from "../core/Locationprefilters.js";

export const mercedesConfig = {
    siteName: "Mercedes-Benz",
    apiUrl: "https://mercedes-benz-beesite-production-gjb.app.beesite.de/search",
    method: "POST",
    needsDescriptionScraping: false,
    filterKeywords: [...COMMON_KEYWORDS],

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

    getTotal: (data) => data?.SearchResult?.SearchResultCountAll || 0,
    getJobs: (data) => (data?.SearchResult?.SearchResultItems || []).map(item => item.MatchedObjectDescriptor),

    // Raw job has PositionLocation[].CityName and CountryName
    preFilter: (rawJob) => {
        const locationText = (rawJob.PositionLocation || [])
            .map(loc => `${loc.CityName || ""} ${loc.CountryName || ""}`)
            .join(' ');
        return createLocationPreFilter({ locationFields: [] })({ location: locationText });
    },

    mapper: (job) => ({
        JobTitle: StripHtml(job.PositionTitle || ""),
        JobID: String(job.ID || job.PositionID || ""),
        Location: (job.PositionLocation || [])
            .map(loc => `${loc.CityName || ""}, ${loc.CountryName || ""}`)
            .join(" | "),
        PostingDate: String(job.PositionStartDate || job.PublicationStartDate || ""),
        ExpirationDate: "",
        Department: job.DepartmentName || job.JobCategory?.[0]?.Name || "N/A",
        Description: StripHtml((job.PositionFormattedDescription || [])
            .map(d => [d.Tasks, d.Qualifications, d.AdditionalInformations].filter(Boolean).join(" "))
            .join(" ")),
        ApplicationURL: String(job.PositionURI || (Array.isArray(job.ApplyURI) ? job.ApplyURI[0] : job.ApplyURI) || ""),
        ContractType: job.PositionOfferingType?.[0]?.Name || "N/A",
        ExperienceLevel: job.CareerLevel?.[0]?.Name || "N/A",
        Compensation: "N/A"
    })
};