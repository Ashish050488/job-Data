import { StripHtml, COMMON_KEYWORDS } from "../utils.js"
import fetch from 'node-fetch';

export const redcarePhramacyConfig = {
    siteName: "Redcare Pharmacy",
    apiUrl: "https://www.redcare-pharmacy.com/api/get-job-posting?locale=en&loadAll=true",
    method: "GET",
    needsDescriptionScraping: true,
    filterKeywords: [...COMMON_KEYWORDS,],
    getBody: () => null,
    getJobs: (data) => data?.items || [],
    
    // ✅ FIX: This tells the scraper the total number of jobs, which stops the infinite loop.
    getTotal: (data) => data?.totalJobs || 0,

    getDetails: async (job) => {
        const jobId = job.id;
        const detailsApiUrl = `https://api.smartrecruiters.com/v1/companies/Redcare-Pharmacy/postings/${jobId}`;
        try {
            const res = await fetch(detailsApiUrl);
            if (!res.ok) {
                console.log(`Redcare details API failed for ${jobId}`);
                return {};
            }
            const data = await res.json();
            const sections = data?.jobAd?.sections;
            const description = [
                sections?.companyDescription?.text,
                sections?.jobDescription?.text,
                sections?.qualifications?.text,
                sections?.additionalInformation?.text,
            ].join(" ");

            return {
                Description: StripHtml(description)
            };
        } catch (error) {
            console.error(`[Redcare Pharmacy] Error fetching details for job ID ${jobId}: ${error.message}`);
            return { Description: "Error fetching details." };
        }
    },

    mapper: (job) => ({
        JobTitle: job.name || "",
        JobID: job.id || "",
        Location: job.location?.fullLocation || "",
        PostingDate: job.releasedDate || "",
        Description: "",
        Department: job.department?.label || "N/A",
        ApplicationURL: `https://www.redcare-pharmacy.com/career/${job.id}`,
        ContractType: job.typeOfEmployment?.label || "N/A",
        ExperienceLevel: job.experienceLevel?.label || "N/A",
        Compensation: "N/A"
    })
};