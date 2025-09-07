// fetchJobs.js
import { SITES_CONFIG } from './config.js';
// ✅ UPDATED IMPORT
import { loadAllExistingIDs, appendJobs } from './excelManager.js';
import { scrapeSite } from './src/scraperEngine.js';

async function runAllScrapers() {
    console.log("🚀 Starting all scrapers sequentially...");
    
    const existingIDsMap = await loadAllExistingIDs();

    // ✅ NEW, SAFER LOOP
    for (const siteConfig of SITES_CONFIG) {
        const newJobsFromSite = await scrapeSite(siteConfig, existingIDsMap);
        
        if (newJobsFromSite.length > 0) {
            console.log(`\n[${siteConfig.siteName}] Saving ${newJobsFromSite.length} new jobs to the Excel file...`);
            const jobsToSave = newJobsFromSite.map(job => {
                const { siteName, ...jobData } = job;
                return jobData;
            });
            await appendJobs(siteConfig.siteName, jobsToSave);
            console.log(`[${siteConfig.siteName}] Saved successfully.`);
        }
    }
    
    console.log("\n✅ All scraping complete.");
}

runAllScrapers();
