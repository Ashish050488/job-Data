// fetchJobs.js
import { SITES_CONFIG } from './config.js';
import { loadAllExistingIDs, appendJobs } from './excelManager.js';
import { scrapeSite } from './src/scraperEngine.js';
import { analyzeJobDescription } from './grokAnalyzer.js';

async function runAllScrapers() {
    console.log("🚀 Starting all scrapers sequentially...");
    
    const existingIDsMap = await loadAllExistingIDs();

    for (const siteConfig of SITES_CONFIG) {
        let newJobs = [];
        const existingIDs = existingIDsMap.get(siteConfig.siteName) || new Set();

        // This is the corrected logic that chooses the right scraper to run.
        if (typeof siteConfig.customScraper === 'function') {
            newJobs = await siteConfig.customScraper(existingIDsMap);
        } else {
            newJobs = await scrapeSite(siteConfig, existingIDsMap);
        }
        
        if (newJobs.length > 0) {
            console.log(`\n[${siteConfig.siteName}] Saving ${newJobs.length} new jobs to the Excel file...`);
            const jobsToSave = newJobs.map(job => {
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