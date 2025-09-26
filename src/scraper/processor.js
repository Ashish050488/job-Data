import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';
import { isGermanRequired, getJobDetails  } from '../../grokAnalyzer.js';
import { AbortController } from 'abort-controller';
import { createJobModel } from '../models/jobModel.js';
import fs from 'fs';

/**
 * ✅ CORRECT: Filters a mapped job based on keywords found ONLY in the job title.
 */
function filterJob(mappedJob, siteConfig) {
    const title = mappedJob.JobTitle.toLowerCase();

    if (siteConfig.filterKeywords && siteConfig.filterKeywords.length > 0) {
        const hasPositiveKeyword = siteConfig.filterKeywords.some(kw => title.includes(kw.toLowerCase()));
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

export async function processJob(rawJob, siteConfig, existingIDs, sessionHeaders) {
    if (siteConfig.preFilter && !siteConfig.preFilter(rawJob)) {
        return null;
    }

    let mappedJob = siteConfig.mapper(rawJob);

    if (!mappedJob.JobID || existingIDs.has(mappedJob.JobID)) {
        return null;
    }
    
    if (!filterJob(mappedJob, siteConfig)) {
        return null;
    }

    if (siteConfig.needsDescriptionScraping) {
        try {
            if (siteConfig.getDetails) {
                const details = await siteConfig.getDetails(rawJob, sessionHeaders);
                if (details.skip) return null;
                mappedJob = { ...mappedJob, ...details };
            } else {
                mappedJob = await scrapeJobDetailsFromPage(mappedJob, siteConfig);
            }
        } catch (pageError) {
            console.error(`[${siteConfig.siteName}] Failed to get details for job ${mappedJob.JobID}: ${pageError.message}`);
            return null;
        }
    }
    
   const germanIsRequired = await isGermanRequired(mappedJob.Description);
    if (germanIsRequired) {
        console.log(`[${siteConfig.siteName}] Discarding job ${mappedJob.JobID} (German language is required).`);
        return null;
    }

    // This call now only gets the experience estimate
    const aiDetails = await getJobDetails(mappedJob.Description, mappedJob.JobTitle);
    console.log(`[AI RESPONSE for ${mappedJob.JobID}]:`, aiDetails);
    
    // The model now creates an object without a summary
    const finalJobData = createJobModel(mappedJob, aiDetails, siteConfig.siteName);

    return finalJobData;
}