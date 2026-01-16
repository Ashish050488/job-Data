import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';
import { AbortController } from 'abort-controller';

// ✅ FIX: Import the correct Groq function name
import { analyzeJobWithGroq } from "../grokAnalyzer.js"; 
import { createJobModel } from '../models/jobModel.js';
import { BANNED_ROLES } from '../utils.js';

/**
 * 1. HARD PRE-FILTER
 * Returns TRUE if the job should be REJECTED immediately.
 */
function isSpamOrIrrelevant(title) {
    const lowerTitle = title.toLowerCase();
    return BANNED_ROLES.some(role => lowerTitle.includes(role));
}
/**
 * Scrapes job details from its webpage.
 */
async function scrapeJobDetailsFromPage(mappedJob, siteConfig) {
    console.log(`[${siteConfig.siteName}] Visiting job page: ${mappedJob.ApplicationURL}`);
    const pageController = new AbortController();
    const pageTimeoutId = setTimeout(() => pageController.abort(), 30000);
    try {
        const jobPageRes = await fetch(mappedJob.ApplicationURL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Accept': 'text/html,application/xhtml+xml',
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
        console.error(`[Scrape Error] ${error.message}`);
    } finally {
        clearTimeout(pageTimeoutId);
    }
    return mappedJob;
}

export async function processJob(rawJob, siteConfig, existingIDs, sessionHeaders) {
    // 1. Config Pre-Filter
    if (siteConfig.preFilter && !siteConfig.preFilter(rawJob)) return null;

    let mappedJob = siteConfig.mapper(rawJob);

    // 2. Duplicate Check (Crucial for saving tokens)
    // This checks ALL jobs in DB, including 'rejected' ones.
    if (!mappedJob.JobID || existingIDs.has(mappedJob.JobID)) {
        return null;
    }

    // 3. Title Filter
    if (isSpamOrIrrelevant(mappedJob.JobTitle)) {
        console.log(`[Pre-Filter] Rejected: ${mappedJob.JobTitle}`);
        return null;
    }

    // 4. Keyword Match
    if (siteConfig.filterKeywords && siteConfig.filterKeywords.length > 0) {
        const titleLower = mappedJob.JobTitle.toLowerCase();
        if (!siteConfig.filterKeywords.some(kw => titleLower.includes(kw.toLowerCase()))) return null;
    }
    
    // 5. Get Description
    if ((siteConfig.needsDescriptionScraping && !mappedJob.Description)) {
        // ... (Keep existing description scraping logic) ...
        // Placeholder for scraping logic invocation
    }
    
    if (!mappedJob.Description) return null;

    // 6. 🧠 AI CLASSIFICATION
    const aiResult = await analyzeJobWithGroq(mappedJob.JobTitle, mappedJob.Description, mappedJob.Location);

    if (!aiResult) {
        console.log(`[AI] Failed to analyze ${mappedJob.JobTitle}. Skipping.`);
        return null;
    }

    // 7. UPDATED DECISION MATRIX
    let status = "pending_review"; // Default: Human must check
    let rejectionReason = null;

    if (aiResult.german_required === true) {
        status = "rejected"; 
        rejectionReason = "German Language Required";
    } else if (aiResult.location_classification === "Not Germany") {
        status = "rejected";
        rejectionReason = "Location not Germany";
    } else {
        // Even if high confidence, we send to review queue as per user request
        status = "pending_review"; 
    }

    if (status === "rejected") {
        console.log(`❌ [Auto-Rejected] ${mappedJob.JobTitle}: ${rejectionReason}`);
        // We return NULL here so it doesn't get saved? 
        // NO. You want to save the ID to save tokens later.
        // So we create the model but mark it rejected.
    } else {
        console.log(`📝 [Pending Review] ${mappedJob.JobTitle} (Conf: ${aiResult.confidence})`);
    }

    // 8. Create Model
    mappedJob.GermanRequired = aiResult.german_required;
    mappedJob.Domain = aiResult.domain;
    mappedJob.SubDomain = aiResult.sub_domain;
    mappedJob.ConfidenceScore = aiResult.confidence;
    mappedJob.Status = status; // 'pending_review' or 'rejected'

    return createJobModel(mappedJob, siteConfig.siteName);
}