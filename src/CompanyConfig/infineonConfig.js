import { StripHtml, COMMON_KEYWORDS } from "../utils.js"

export const infineonConfig={
    siteName: "Infineon",
    apiUrl: "https://jobs.infineon.com/api/apply/v2/jobs",
    suggestUrl: "https://jobs.infineon.com/api/suggest",
    method: "GET",

    filterKeywords: [
        "manager", "lead", "director", "head", "principal", "senior",
        "product owner", "program manager", "project manager"
    ],

    customScraper: async function(existingIDsMap) {
        const existingIDs = existingIDsMap.get(this.siteName) || new Set();
        const allNewJobs = [];
        const foundJobIDs = new Set();
        const headers = {
            'accept': 'application/json',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'referer': 'https://jobs.infineon.com'
        };

        // --- Stage 1: Discover Locations ---
        console.log(`[Infineon] Discovering all active German locations...`);
        const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');
        const germanLocations = new Set();
        for (const letter of alphabet) {
            const discoveryParams = new URLSearchParams({ term: letter, dictionary: 'job_location', limit: 100, domain: 'infineon.com' });
            const discoveryUrl = `${this.suggestUrl}?${discoveryParams.toString()}`;
            try {
                const res = await fetch(discoveryUrl, { headers });
                const data = await res.json();
                if (data.suggestions) {
                    data.suggestions.forEach(suggestion => {
                        if (suggestion.term && suggestion.term.endsWith("(Germany)")) {
                            germanLocations.add(suggestion.term);
                        }
                    });
                }
            } catch (e) {}
        }
        console.log(`[Infineon] Discovered ${germanLocations.size} unique locations. Starting full scrape...`);
        
        // --- Stage 2: Fetch and Filter Jobs by Location ---
        for (const location of germanLocations) {
            console.log(`--- [Infineon] Searching location: ${location} ---`);
            let offset = 0;
            const limit = 20;
            let hasMore = true;

            while (hasMore) {
                const params = new URLSearchParams({ hl: 'en', location, start: offset, num: limit });
                const url = `${this.apiUrl}?${params.toString()}`;
                const res = await fetch(url, { headers });
                
                if (!res.ok) { hasMore = false; continue; }

                const data = await res.json();
                const jobs = data?.positions || [];

                if (jobs.length === 0) {
                    hasMore = false;
                    continue;
                }

                for (const rawJob of jobs) {
                    const preliminaryMap = this.mapper(rawJob);
                    const title = preliminaryMap.JobTitle.toLowerCase();
                    const description = preliminaryMap.Description.toLowerCase();
                    const textToSearch = title + ' ' + description;

                    // This filter now only checks for positive keywords.
                    if (this.filterKeywords && this.filterKeywords.length > 0) {
                        const hasPositiveKeyword = this.filterKeywords.some(kw => textToSearch.includes(kw.toLowerCase()));
                        if (!hasPositiveKeyword) continue;
                    }
                    
                    const jobID = preliminaryMap.JobID;
                    if (jobID && !existingIDs.has(jobID) && !foundJobIDs.has(jobID)) {
                        foundJobIDs.add(jobID);
                        let mappedJob = preliminaryMap;
                        
                        if (!rawJob.job_description) {
                           const details = await this.getDetails(rawJob);
                           mappedJob = { ...mappedJob, ...details };
                        }

                        console.log(`[Infineon] New job found: ${mappedJob.JobID}. Analyzing...`);
                        const aiResult = await analyzeJobDescription(mappedJob.Description);
                        const finalJobData = { ...mappedJob, GermanRequired: String(aiResult.germanRequired || "N/A"), Summary: String(aiResult.summary || ""), siteName: this.siteName };
                        allNewJobs.push(finalJobData);
                    }
                }
                offset += 20;
            }
        }
        
        console.log(`[Infineon] Finished. Found ${allNewJobs.length} new jobs.`);
        return allNewJobs;
    },
    
    mapper: (job) => {
        const postingDate = job.t_create ? new Date(job.t_create * 1000).toISOString().split('T')[0] : "";
        return {
            JobTitle: StripHtml(job.name || ""),
            JobID: String(job.id || ""),
            Location: job.location || "N/A",
            PostingDate: postingDate,
            Department: job.department || "N/A",
            Description: StripHtml(job.job_description || ""),
            ApplicationURL: job.canonicalPositionUrl || `https://jobs.infineon.com/careers/job/${job.id}`,
            ContractType: "",
            ExperienceLevel: "N/A",
            Compensation: "N/A",
        };
    },
    getDetails: async (job) => {
        try {
            const detailsApiUrl = `https://jobs.infineon.com/api/apply/v2/jobs/${job.id}?domain=infineon.com`;
            const res = await fetch(detailsApiUrl);
            if (!res.ok) return {};
            const detailedJob = await res.json();
            return {
                Description: StripHtml(detailedJob?.job_description || ""),
                ContractType: detailedJob?.custom_JD?.data_fields?.type_of_employment?.[0] || "N/A"
            };
        } catch (e) {
            return {};
        }
    }
}