// src/scraperEngine.js
import { initializeSession, fetchJobsPage } from './network.js';
import { shouldContinuePaging } from './pagination.js';
import { processJob } from './processor.js';
import { saveJobs } from "../Db/databaseManager.js";
import { sleep } from '../utils.js';

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
                
                console.log(`\n[${siteName}]-- Processing Batch of ${batch.length} jobs --`);
                batch.forEach((rawJob, index) => {
                    // ✅ FIX: Added 'rawJob.PositionTitle' to this line to find the Mercedes-Benz job title.
                    const jobTitle = rawJob._source ? rawJob._source.title : (rawJob.titel || rawJob.title || rawJob.PositionTitle);
                    const jobNumber = offset + i + index + 1;
                    console.log(`  #${jobNumber}: Found job: ${jobTitle}`);
                });

                const jobPromises = batch.map(rawJob => 
                    processJob(rawJob, siteConfig, existingIDs, sessionHeaders)
                );
                
                const processedJobs = await Promise.all(jobPromises);
                const newJobsInBatch = processedJobs.filter(job => job !== null);

                if (newJobsInBatch.length > 0) {
                    console.log(`[${siteName}] Saving ${newJobsInBatch.length} valid job(s) from batch to database...`);
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
        console.log(`\n[${siteName}] Finished. Found ${allNewJobs.length} total new jobs.`);
    } else {
        console.log(`\n[${siteName}] No new jobs found.`);
    }
    return allNewJobs;
}