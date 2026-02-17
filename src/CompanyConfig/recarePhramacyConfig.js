import { StripHtml, COMMON_KEYWORDS } from "../utils.js";
import { createLocationPreFilter } from "../core/Locationprefilters.js";
import fetch from 'node-fetch';

export const redcarePhramacyConfig = {
    siteName: "Redcare Pharmacy",
    apiUrl: "https://www.redcare-pharmacy.com/api/get-job-posting?locale=en&loadAll=true",
    method: "GET",
    needsDescriptionScraping: true,
    filterKeywords: [...COMMON_KEYWORDS],

    getBody: () => null,
    getJobs: (data) => data?.items || [],
    getTotal: (data) => data?.totalJobs || 0,

    // Raw job has 'location.country' (country code 'de') and 'location.city'
    preFilter: (rawJob) => {
        const locationText = `${rawJob.location?.city || ""} ${rawJob.location?.country || ""}`;
        return createLocationPreFilter({ locationFields: [] })({ location: locationText });
    },

    getDetails: async (job) => {
        const detailsApiUrl = `https://api.smartrecruiters.com/v1/companies/Redcare-Pharmacy/postings/${job.id}`;
        try {
            const res = await fetch(detailsApiUrl);
            if (!res.ok) return {};
            const data = await res.json();
            const sections = data?.jobAd?.sections;
            const description = [
                sections?.companyDescription?.title, sections?.companyDescription?.text,
                sections?.jobDescription?.title, sections?.jobDescription?.text,
                sections?.qualifications?.title, sections?.qualifications?.text,
                sections?.additionalInformation?.title, sections?.additionalInformation?.text,
            ].filter(Boolean).join(" ");
            return { Description: StripHtml(description) };
        } catch (error) {
            console.error(`[Redcare Pharmacy] Error fetching details for job ${job.id}: ${error.message}`);
            return {};
        }
    },

    mapper: (job) => {
        const countryMap = { 'de': 'Germany', 'at': 'Austria', 'ch': 'Switzerland' };
        const countryName = countryMap[(job.location?.country || "").toLowerCase()] || job.location?.country || "";
        const cleanLocation = job.location?.city && countryName
            ? `${job.location.city}, ${countryName}`
            : job.location?.fullLocation || "";
        return {
            JobTitle: job.name || "",
            JobID: job.id || "",
            Location: cleanLocation,
            PostingDate: job.releasedDate || "",
            ExpirationDate: "",
            Description: "",
            Department: job.department?.label || "N/A",
            ApplicationURL: `https://www.redcare-pharmacy.com/careers/open-jobs/details/${job.id}`,
            ContractType: job.typeOfEmployment?.label || "N/A",
            ExperienceLevel: job.experienceLevel?.label || "N/A",
            Compensation: "N/A"
        };
    }
};