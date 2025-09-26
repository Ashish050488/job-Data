// src/configs/heidelbergMaterialsConfig.js

import { StripHtml } from "../utils.js";

export const heidelbergMaterialsConfig = {
    siteName: "Heidelberg Materials",
    apiUrl: "https://heidelbergmaterials.wd3.myworkdayjobs.com/wday/cxs/heidelbergmaterials/Global_HM_Career_Site/jobs",
    baseUrl: "https://heidelbergmaterials.wd3.myworkdayjobs.com/Global_HM_Career_Site",
    method: "POST",
    needsSession: true,
    needsDescriptionScraping: true,

    // ✅ NEW: Improved keyword list with broader English terms and essential German equivalents.
    filterKeywords: [
        // English Keywords
        "manager", "lead", "leader", "head", "director", "principal",
        "chief", "vp", "vice president", "supervisor", "superintendent",
        "project manager", "program manager", "product owner", "team lead",
        
        // German Keywords
        "leiter", "leiterin", // Leader (male/female)
        "managerin", // Manager (female)
        "direktor", "direktorin", // Director (male/female)
        "projektleiter", "projektmanager", // Project Manager/Leader
        "teamleiter", "gruppenleiter", // Team Lead / Group Lead
        "abteilungsleiter" // Department Head
    ],

    getBody: (offset, limit) => ({
        "appliedFacets": {
            "locationCountry": ["dcc5b7608d8644b3a93716604e78e995"] 
        },
        "limit": limit,
        "offset": offset,
        "searchText": ""
    }),

    getTotal: (data) => data?.total || 0,
    
    getJobs: (data) => data?.jobPostings || [],
    
    getDetails: async (job, sessionHeaders) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        try {
            const detailsApiUrl = `https://heidelbergmaterials.wd3.myworkdayjobs.com/wday/cxs/heidelbergmaterials/Global_HM_Career_Site${job.externalPath}`;
            const res = await fetch(detailsApiUrl, { 
                headers: sessionHeaders, 
                signal: controller.signal 
            });

            if (!res.ok) { return { skip: true }; }
            
            const data = await res.json();
            const jobInfo = data?.jobPostingInfo;

            return {
                Description: StripHtml(jobInfo?.jobDescription || ""),
                ContractType: jobInfo?.timeType || "N/A",
                Location: jobInfo?.jobRequisitionLocation?.descriptor || jobInfo?.location || "N/A"
            };
        } catch (error) {
            console.error(`[Heidelberg Materials] Error getting details for job ${job.bulletFields?.[0]}: ${error.message}`);
            return { skip: true };
        } finally {
            clearTimeout(timeoutId);
        }
    },
    
    mapper: (job) => ({
        JobTitle: job.title || "",
        JobID: String(job.bulletFields?.[0] || ""),
        Location: job.locationsText || "",
        PostingDate: job.postedOn || "",
        Department: "",
        Description: "",
        ApplicationURL: `https://heidelbergmaterials.wd3.myworkdayjobs.com/Global_HM_Career_Site${job.externalPath}`,
        ContractType: "",
        ExperienceLevel: "N/A",
        Compensation: "N/A"
    })
};