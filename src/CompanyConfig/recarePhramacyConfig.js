import { StripHtml, COMMON_KEYWORDS } from "../utils.js"
import fetch from 'node-fetch';

export const redcarePhramacyConfig = {
    siteName: "Redcare Pharmacy",
    apiUrl: "https://www.redcare-pharmacy.com/api/get-job-posting?locale=en&loadAll=true",
    method: "GET",
    needsDescriptionScraping: true,
    filterKeywords: [...COMMON_KEYWORDS],
    getBody: () => null,
    
    getJobs: (data) => data?.items || [],
    
    // Fix infinite loop
    getTotal: (data) => data?.totalJobs || 0,

    // ✅ ADDED: Pre-filter to ensure we only pick up German jobs.
    // The API returns 'de', 'nl', 'it', 'at', 'cz'. We only want 'de'.
    preFilter: (job) => {
        const country = job.location?.country?.toLowerCase();
        // Allow Germany ('de') or Remote jobs based in Germany
        return country === 'de';
    },

    getDetails: async (job) => {
        const jobId = job.id;
        // SmartRecruiters public API for details
        const detailsApiUrl = `https://api.smartrecruiters.com/v1/companies/Redcare-Pharmacy/postings/${jobId}`;
        try {
            const res = await fetch(detailsApiUrl);
            if (!res.ok) {
                // console.log(`Redcare details API failed for ${jobId}`);
                return {};
            }
            const data = await res.json();
            const sections = data?.jobAd?.sections;
            
            // Combine all sections for a full description
            const description = [
                sections?.companyDescription?.title,
                sections?.companyDescription?.text,
                sections?.jobDescription?.title,
                sections?.jobDescription?.text,
                sections?.qualifications?.title,
                sections?.qualifications?.text,
                sections?.additionalInformation?.title,
                sections?.additionalInformation?.text,
            ].filter(Boolean).join(" <br/> "); // Use HTML line breaks or spaces

            return {
                Description: StripHtml(description)
            };
        } catch (error) {
            console.error(`[Redcare Pharmacy] Error fetching details for job ID ${jobId}: ${error.message}`);
            return { Description: "Error fetching details." };
        }
    },

    mapper: (job) => {
        // ✅ CLEANER LOCATION
        let cleanLocation = job.location?.fullLocation || "";
        if (job.location?.city && job.location?.country) {
            const countryMap = { 'de': 'Germany', 'at': 'Austria', 'ch': 'Switzerland' };
            const countryName = countryMap[job.location.country.toLowerCase()] || job.location.country;
            cleanLocation = `${job.location.city}, ${countryName}`;
        }

        return {
            JobTitle: job.name || "",
            JobID: job.id || "",
            Location: cleanLocation,
            PostingDate: job.releasedDate || "",
            Description: "", 
            Department: job.department?.label || "N/A",

            // ✅ FIX: Construction of the ApplicationURL
            // The actual website uses /careers/open-jobs/details/ followed by the ID
            ApplicationURL: `https://www.redcare-pharmacy.com/careers/open-jobs/details/${job.id}`,

            ContractType: job.typeOfEmployment?.label || "N/A",
            ExperienceLevel: job.experienceLevel?.label || "N/A",
            Compensation: "N/A"
        };
    }
};