// src/scraperEngine.js
import { initializeSession, fetchJobsPage } from './scraper/network.js';
import { shouldContinuePaging } from './scraper/pagination.js';
import { processJob } from './scraper/processor.js';
import { saveJobs } from "../databaseManager.js"; // <-- IMPORT saveJobs
import { sleep } from './utils.js';

export async function scrapeSite(siteConfig, existingIDsMap) {
    const siteName = siteConfig.siteName;
    const existingIDs = existingIDsMap.get(siteName) || new Set();
    const allNewJobs = [];
    
    const limit = siteConfig.limit || 20;
    let offset = 0;
    let hasMore = true;
    let totalJobs = 0;

    console.log(`\n--- Starting scrape for [${siteName}] ---`);

    try {
        const sessionHeaders = await initializeSession(siteConfig);

        while (hasMore) {
            const scrapeStartTime = new Date();
            console.log(`[${siteName}] Fetching page with offset: ${offset}...`);
            const data = await fetchJobsPage(siteConfig, offset, limit, sessionHeaders);
            const jobs = siteConfig.getJobs(data);

            if (!jobs || jobs.length === 0) {
                break;
            }

            if (offset === 0 && siteConfig.getTotal) {
                totalJobs = siteConfig.getTotal(data);
            }

            const batchSize = 3;
            for (let i = 0; i < jobs.length; i += batchSize) {
                const batch = jobs.slice(i, i + batchSize);
                console.log(`[${siteName}] Processing batch of ${batch.length} jobs...`);

                const jobPromises = batch.map(rawJob => 
                    processJob(rawJob, siteConfig, existingIDs, sessionHeaders)
                );
                
                const processedJobs = await Promise.all(jobPromises);
                const newJobsInBatch = processedJobs.filter(job => job !== null);

                if (newJobsInBatch.length > 0) {
                    // ✅ SAVE THE BATCH TO THE DATABASE IMMEDIATELY
                    console.log(`[${siteName}] Saving batch of ${newJobsInBatch.length} jobs to the database...`);
                    const jobsToSave = newJobsInBatch.map(job => ({ ...job, scrapedAt: scrapeStartTime }));
                    await saveJobs(jobsToSave);
                    
                    allNewJobs.push(...newJobsInBatch);
                    newJobsInBatch.forEach(job => existingIDs.add(job.JobID));
                }

                if (i + batchSize < jobs.length) {
                    await sleep(3000); 
                }
            }
            
            hasMore = shouldContinuePaging(siteConfig, jobs, offset, limit, totalJobs);
            offset += limit;
        }
    } catch (error) {
        console.error(`[${siteName}] ERROR during scrape: ${error.message}.`);
    }

    if (allNewJobs.length > 0) {
        console.log(`[${siteName}] Finished. Found ${allNewJobs.length} total new jobs.`);
    } else {
        console.log(`[${siteName}] No new jobs found.`);
    }
    return allNewJobs;
}