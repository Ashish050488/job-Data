import { StripHtml, COMMON_KEYWORDS } from "../utils.js";
import { createLocationPreFilter } from "../core/Locationprefilters.js";
import { JSDOM } from 'jsdom';
import fetch from 'node-fetch';

export const commerzbankConfig = {
    siteName: "Commerzbank",
    apiUrl: "https://api-jobs.commerzbank.com/search/",
    method: "GET",
    needsDescriptionScraping: true,
    filterKeywords: [...COMMON_KEYWORDS],

    buildPageUrl: (offset, limit) => {
        const data = {
            LanguageCode: "EN",
            SearchParameters: {
                FirstItem: offset + 1,
                CountItem: limit,
                Sort: [{ Criterion: "PublicationStartDate", Direction: "DESC" }],
                MatchedObjectDescriptor: [
                    "ID", "PositionTitle", "PositionURI", "PublicationStartDate",
                    "ParentOrganizationName", "CareerLevel.Name", "PositionFormattedDescription",
                    "PositionLocation.CountryName", "PositionLocation.CityName"
                ]
            },
            SearchCriteria: []
        };
        const encodedData = encodeURIComponent(JSON.stringify(data));
        return `https://api-jobs.commerzbank.com/search/?data=${encodedData}`;
    },

    getTotal: (data) => data?.SearchResult?.SearchResultCountAll || 0,
    getJobs: (data) => (data?.SearchResult?.SearchResultItems || []).map(item => item.MatchedObjectDescriptor),

    // Raw job has PositionLocation[0].CountryName and CityName
    preFilter: (rawJob) => {
        const locationText = (rawJob.PositionLocation || [])
            .map(loc => `${loc.CityName || ""} ${loc.CountryName || ""}`)
            .join(' ');
        return createLocationPreFilter({ locationFields: [] })({ location: locationText });
    },

    getDetails: async (job) => {
        try {
            const res = await fetch(job.PositionURI);
            if (!res.ok) return { Description: "" };
            const html = await res.text();
            const dom = new JSDOM(html);
            const descriptionElements = dom.window.document.querySelectorAll('div.panel-body');
            const description = descriptionElements.length > 0
                ? Array.from(descriptionElements).map(el => el.textContent).join('\n\n')
                : "";
            return { Description: StripHtml(description) };
        } catch (error) {
            console.error(`[Commerzbank] Failed to scrape details for job ${job.ID}: ${error.message}`);
            return { Description: "" };
        }
    },

    mapper: (job) => ({
        JobTitle: job.PositionTitle || "",
        JobID: String(job.ID || ""),
        Location: (job.PositionLocation || [])
            .map(loc => `${loc.CityName || ""}, ${loc.CountryName || ""}`.trim())
            .join(" | ")
            .replace(/^, /, ""),
        PostingDate: job.PublicationStartDate || "",
        ExpirationDate: "",
        Department: job.ParentOrganizationName || "N/A",
        Description: StripHtml((job.PositionFormattedDescription || []).map(d => d.Content).join(" ")),
        ApplicationURL: job.PositionURI || "",
        ContractType: "N/A",
        ExperienceLevel: job.CareerLevel?.[0]?.Name || "N/A",
        Compensation: "N/A"
    })
};