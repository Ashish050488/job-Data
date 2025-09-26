// fetchJobs.js
import { SITES_CONFIG } from './config.js';
import { loadAllExistingIDs, deleteOldJobs } from './databaseManager.js';
import { scrapeSite } from './src/scraperEngine.js';

async function runAllScrapers() {
    console.log("🚀 Starting all scrapers sequentially...");
    
    const existingIDsMap = await loadAllExistingIDs();
    const allNewJobsBySite = new Map();

    for (const siteConfig of SITES_CONFIG) {
        // The timestamp for cleanup is now handled by the 'updatedAt' field in the model
        const scrapeStartTime = new Date();
        
        const newJobs = await scrapeSite(siteConfig, existingIDsMap);
        
        if (newJobs.length > 0) {
            allNewJobsBySite.set(siteConfig.siteName, newJobs);
        }
        
        await deleteOldJobs(siteConfig.siteName, scrapeStartTime);
    }
    
    console.log("\n✅ All scraping complete.");

    // await sendEmailNotification(allNewJobsBySite);
}

runAllScrapers();