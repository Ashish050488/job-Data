import { StripHtml, COMMON_KEYWORDS } from "../utils.js";
import fetch from 'node-fetch'; // We need fetch for the getDetails function

export const infineonConfig = {
    siteName: "Infineon",
    
    // ✅ FIX: Using the new Search API you found
    apiUrl: "https://jobs.infineon.com/api/pcsx/search",
    method: "GET",
    
    // This API needs a description scraping step
    needsDescriptionScraping: true, 

    filterKeywords: COMMON_KEYWORDS,
    getBody: () => null,

    /**
     * ✅ FIX: This function builds the correct URL with pagination
     * and filters for Germany.
     */
    buildPageUrl: (offset, limit, filterKeywords) => {
        const params = new URLSearchParams({
            domain: 'infineon.com',
            query:"",
            location: 'Germany', // Filter for Germany
            start: offset,
            num: limit,
            sort_by: 'timestamp' // Get newest jobs first
        });
        return `${infineonConfig.apiUrl}?${params.toString()}`;
    },

    // ✅ FIX: Points to the new data structure
    getJobs: (data) => data?.data?.positions || [],
    getTotal: (data) => data?.data?.count || 0,

    /**
     * ✅ FIX: Uses the new details API endpoint you found
     * to get the full description.
     */
    getDetails: async (rawJob) => {
        const jobId = rawJob.id;
        const detailsApiUrl = `https://jobs.infineon.com/api/pcsx/position_details?position_id=${jobId}&domain=infineon.com&hl=en`;
        
        try {
            const res = await fetch(detailsApiUrl);
            if (!res.ok) {
                console.error(`[Infineon] Details API failed for job ${jobId}`);
                return {};
            }
            
            const data = await res.json();
            const detailedJob = data?.data;
            if (!detailedJob) return {};

            // Extract details from the second API call
            return {
                Description: StripHtml(detailedJob.jobDescription || ""),
                ContractType: detailedJob.efcustomTextTypeOfEmployment?.[0] || "N/A",
                ExperienceLevel: detailedJob.efcustomTextJoinAs?.[0] || "N/A"
            };

        } catch (error) {
            console.error(`[Infineon] Error fetching details for job ${jobId}: ${error.message}`);
            return {};
        }
    },

    /**
     * ✅ FIX: Updated mapper for the new job list structure
     */
    mapper: (job) => {
        // 'postedTs' is in seconds, convert to milliseconds for new Date()
        const postedDate = job.postedTs ? new Date(job.postedTs * 1000).toISOString() : "";
        
        return {
            JobTitle: StripHtml(job.name || ""),
            JobID: String(job.id || ""),
            Location: (job.locations || []).join(' | '),
            PostingDate: postedDate.split('T')[0],
            Department: job.department || "N/A",
            ApplicationURL: `https://jobs.infineon.com${job.positionUrl}`,
            
            // These will be filled in by getDetails()
            Description: "", 
            ContractType: "N/A",
            ExperienceLevel: "N/A",
        };
    },
};