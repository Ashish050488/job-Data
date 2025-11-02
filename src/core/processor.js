import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';
import { isGermanRequired } from "../grokAnalyzer.js";
import { createJobModel } from '../models/jobModel.js';
import { AbortController } from 'abort-controller';
import fs from "fs"
/**
 * ✅ FINAL: Filters based on keywords in BOTH the Job Title and the Description.
 */
function filterJob(mappedJob, siteConfig) {
    const title = mappedJob.JobTitle.toLowerCase();
    const description = mappedJob.Description.toLowerCase();
    const textToSearch = title + ' ' + description; // Combine both for a comprehensive search

    if (siteConfig.filterKeywords && siteConfig.filterKeywords.length > 0) {
        const hasPositiveKeyword = siteConfig.filterKeywords.some(kw => textToSearch.includes(kw.toLowerCase()));
        if (!hasPositiveKeyword) return false;
    }
    if (siteConfig.negativeKeywords && siteConfig.negativeKeywords.length > 0) {
        const hasNegativeKeyword = siteConfig.negativeKeywords.some(kw => title.includes(kw.toLowerCase()));
        if (hasNegativeKeyword) return false;
    }
    return true;
}

/**
 * Scrapes job details from its webpage.
 * (This function is unchanged)
 */
async function scrapeJobDetailsFromPage(mappedJob, siteConfig) {
    console.log(`[${siteConfig.siteName}] Visiting job page for details: ${mappedJob.ApplicationURL}`);
    const pageController = new AbortController();
    const pageTimeoutId = setTimeout(() => pageController.abort(), 30000);
    try {
        const jobPageRes = await fetch(mappedJob.ApplicationURL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Referer': siteConfig.baseUrl || 'https://www.google.com/'
            },
            signal: pageController.signal
        });
        const html = await jobPageRes.text();
        //  fs.writeFileSync('debug.html', html); 
        const dom = new JSDOM(html);
        const document = dom.window.document;
        if (siteConfig.descriptionSelector) {
            const descriptionElement = document.querySelector(siteConfig.descriptionSelector);
            if (descriptionElement) {
                mappedJob.Description = descriptionElement.textContent.replace(/\s+/g, ' ').trim();
            }
        }
    } catch (error) {
        throw error;
    } finally {
        clearTimeout(pageTimeoutId);
    }
    return mappedJob;
}

/**
 * ✅ FINAL: Processes a job with the correct logical order.
 */
export async function processJob(rawJob, siteConfig, existingIDs, sessionHeaders) {
    if (siteConfig.preFilter && !siteConfig.preFilter(rawJob)) {
        return null;
    }

    let mappedJob = siteConfig.mapper(rawJob);

    if (!mappedJob.JobID || existingIDs.has(mappedJob.JobID)) {
        return null;
    }
    
    // Step 1: Get the full description from either the API (via mapper) or by scraping the page.
    if ((siteConfig.needsDescriptionScraping && !mappedJob.Description)) {
        try {
            if (siteConfig.getDetails) { // For API-based detail fetching
                const details = await siteConfig.getDetails(rawJob, sessionHeaders);
                if (details.skip) return null;
                mappedJob = { ...mappedJob, ...details };
            } else { // For HTML-based page scraping
                mappedJob = await scrapeJobDetailsFromPage(mappedJob, siteConfig);
            }
        } catch (pageError) {
            console.error(`[${siteConfig.siteName}] Failed to get details for job ${mappedJob.JobID}: ${pageError.message}`);
            return null;
        }
    }
    
    // If there's still no description, discard the job.
    if (!mappedJob.Description) {
        return null;
    }

    // Step 2: Run the keyword filter now that we have the full description.
    if (!filterJob(mappedJob, siteConfig)) {
        return null;
    }

    // Step 3: AI Check for German Language Requirement.
    const germanIsRequired = await isGermanRequired(mappedJob.Description, mappedJob.JobTitle);
    if (germanIsRequired) {
        console.log(`[${siteConfig.siteName}] Discarding job ${mappedJob.JobID} (German language is required).`);
        return null;
    }

    // Step 4: Create the final object using the model.
    const finalJobData = createJobModel(mappedJob, siteConfig.siteName);

    return finalJobData;
}