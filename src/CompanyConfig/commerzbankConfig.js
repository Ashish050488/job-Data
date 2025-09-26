import { StripHtml, COMMON_KEYWORDS } from "../utils.js";
import { JSDOM } from 'jsdom';
import fetch from 'node-fetch';


export const commerzbankConfig = {
    siteName: "Commerzbank",
    apiUrl: "https://api-jobs.commerzbank.com/search/",
    method: "GET",
    
    filterKeywords: [
        "project manager", "program manager", "product manager", "product owner",
        "lead", "team lead", "tech lead", "engineering manager",
        "head of", "director", "chief", "vp", "vice president",
        "principal", "senior",
        "leiter", "manager", "direktor", "projektleiter", "teamleiter"
    ],

    needsDescriptionScraping: true,

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

    // ✅ NEW: This filter runs on the raw data from the master list.
    // It's the most efficient place to check the country.
    preFilter: (job) => {
        return job.PositionLocation?.[0]?.CountryName === "Germany";
    },

    getDetails: async (job) => {
        // The country check has been moved to preFilter, making this function cleaner.
        try {
            const res = await fetch(job.PositionURI);
            if (!res.ok) return { Description: "Could not load description." };
            
            const html = await res.text();
            const descriptionSelector = 'div.panel-body'; 
            
            const dom = new JSDOM(html);
            const descriptionElements = dom.window.document.querySelectorAll(descriptionSelector);
            
            let description = "Description not found.";
            if (descriptionElements && descriptionElements.length > 0) {
                description = Array.from(descriptionElements).map(el => el.textContent).join('\n\n');
                description = StripHtml(description);
            }

            return { Description: description };
        } catch (error) {
            console.error(`[Commerzbank] Failed to scrape details for job ${job.ID}: ${error.message}`);
            return { Description: "Error scraping description." };
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
        Department: job.ParentOrganizationName || "N/A",
        Description: StripHtml((job.PositionFormattedDescription || []).map(d => d.Content).join(" ")),
        ApplicationURL: job.PositionURI || "",
        ContractType: "N/A",
        ExperienceLevel: (job.CareerLevel?.[0]?.Name || "N/A")
    })
};

