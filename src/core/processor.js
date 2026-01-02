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
    
    // Check banned roles
    const isBanned = BANNED_ROLES.some(role => lowerTitle.includes(role));
    if (isBanned) return true;

    return false;
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
    // 1. Config Pre-Filter (Country check usually)
    if (siteConfig.preFilter && !siteConfig.preFilter(rawJob)) {
        return null;
    }

    let mappedJob = siteConfig.mapper(rawJob);

    // 2. Duplicate Check
    if (!mappedJob.JobID || existingIDs.has(mappedJob.JobID)) {
        return null;
    }

    // 3. TITLE FILTER (Hard Rejection of Student/Intern roles)
    if (isSpamOrIrrelevant(mappedJob.JobTitle)) {
        console.log(`[Pre-Filter] Rejected: ${mappedJob.JobTitle} (Banned Role)`);
        return null; // Stop processing
    }

    // 4. Keyword Match (Optional)
    if (siteConfig.filterKeywords && siteConfig.filterKeywords.length > 0) {
        const titleLower = mappedJob.JobTitle.toLowerCase();
        const hasKeyword = siteConfig.filterKeywords.some(kw => titleLower.includes(kw.toLowerCase()));
        if (!hasKeyword) return null;
    }
    
    // 5. Get Description
    if ((siteConfig.needsDescriptionScraping && !mappedJob.Description)) {
        try {
            if (siteConfig.getDetails) { 
                const details = await siteConfig.getDetails(rawJob, sessionHeaders);
                if (details.skip) return null;
                mappedJob = { ...mappedJob, ...details };
            } else { 
                mappedJob = await scrapeJobDetailsFromPage(mappedJob, siteConfig);
            }
        } catch (pageError) {
            return null;
        }
    }
    
    if (!mappedJob.Description) return null;

    // 6. 🧠 AI CLASSIFICATION (GROQ)
    // ✅ FIX: Use the Groq function here
    const aiResult = await analyzeJobWithGroq(mappedJob.JobTitle, mappedJob.Description, mappedJob.Location);

    if (!aiResult) {
        console.log(`[AI] Failed to analyze ${mappedJob.JobTitle}. Skipping.`);
        return null;
    }

    // 7. DECISION MATRIX
    let status = "review"; // Default
    let rejectionReason = null;

    if (aiResult.german_required === true) {
        status = "rejected";
        rejectionReason = "German Language Required";
    } else if (aiResult.location_classification === "Not Germany") {
        status = "rejected";
        rejectionReason = "Location not Germany";
    } else if (aiResult.location_classification === "Germany" && aiResult.confidence >= 0.85) {
        status = "approved"; // High trust, auto-publish
    } else {
        status = "review"; // Low confidence or unsure
    }

    if (status === "rejected") {
        console.log(`❌ [Rejected] ${mappedJob.JobTitle}: ${rejectionReason}`);
        return null; 
    }

    console.log(`✅ [${status.toUpperCase()}] ${mappedJob.JobTitle} (Conf: ${aiResult.confidence})`);

    // 8. Create Model with AI Data
    mappedJob.GermanRequired = aiResult.german_required;
    mappedJob.Domain = aiResult.domain;
    mappedJob.SubDomain = aiResult.sub_domain;
    mappedJob.ConfidenceScore = aiResult.confidence;
    mappedJob.Status = status;

    const finalJobData = createJobModel(mappedJob, siteConfig.siteName);

    return finalJobData;
}