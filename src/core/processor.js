import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';
import { AbortController } from 'abort-controller';

// ✅ FIX: Import the correct Groq function name
import { analyzeJobWithGroq } from "../grokAnalyzer.js"; 
import { createJobModel } from '../models/jobModel.js';
import { createJobTestLog } from '../models/jobTestLogModel.js'; // ✅ NEW
import { saveJobTestLog } from '../Db/databaseManager.js'; // ✅ NEW
import { Analytics } from '../models/analyticsModel.js'; // ✅ ADDED: Analytics Model
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


export async function processJob(rawJob, siteConfig, existingIDs, sessionHeaders, allRawJobs) {
    // 1. Config Pre-Filter
    if (siteConfig.preFilter && !siteConfig.preFilter(rawJob)) return null;

    let mappedJob = siteConfig.mapper(rawJob);

    // 2. Duplicate Check (Crucial for saving tokens)
    // This checks ALL jobs in DB, including 'rejected' ones.
    if (!mappedJob.JobID || existingIDs.has(mappedJob.JobID)) {
        return null;
    }

    // ✅ ANALYTICS 1: New Unique Job Data Fetched
    // We count it here because it passed the duplicate check (it's new data)
    await Analytics.increment('jobsScraped');

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
        // ✅ NEW: Check if config has custom getDetails function (for Workday APIs like Covestro)
        if (typeof siteConfig.getDetails === 'function') {
            try {
                const details = await siteConfig.getDetails(rawJob, sessionHeaders);
                
                // ✅ Handle skip flag
                if (details && details.skip) {
                    console.log(`[${siteConfig.siteName}] Job skipped by getDetails`);
                    return null;
                }
                
                // ✅ Merge details into mapped job
                if (details) {
                    Object.assign(mappedJob, details);
                }
            } catch (error) {
                console.error(`[${siteConfig.siteName}] getDetails error: ${error.message}`);
                return null;
            }
        } else {
            // ✅ FALLBACK: Use generic HTML scraper
            mappedJob = await scrapeJobDetailsFromPage(mappedJob, siteConfig);
        }
    }
    
    if (!mappedJob.Description) return null;

    // ✅ ANALYTICS 2: Sent to AI
    // It passed all filters and is about to cost money/tokens
    await Analytics.increment('jobsSentToAI');

    // 6. 🧠 AI CLASSIFICATION
    const aiResult = await analyzeJobWithGroq(mappedJob.JobTitle, mappedJob.Description, mappedJob.Location);

    if (!aiResult) {
        console.log(`[AI] Failed to analyze ${mappedJob.JobTitle}. Skipping.`);
        return null;
    }

    // ✅ 7. STRICT FILTERING LOGIC - RETURN NULL FOR INVALID JOBS
    // Only save jobs that meet ALL criteria:
    // - Location must be Germany
    // - Job must be English-speaking
    // - German must NOT be required
    
    let finalDecision = "accepted";
    let rejectionReason = null;
    
    if (aiResult.location_classification !== "Germany") {
        finalDecision = "rejected";
        rejectionReason = "Location not in Germany";
        console.log(`❌ [Rejected - Not Germany] ${mappedJob.JobTitle} (Location: ${aiResult.location_classification})`);
    } else if (aiResult.english_speaking !== true) {
        finalDecision = "rejected";
        rejectionReason = "Not English-speaking";
        console.log(`❌ [Rejected - Not English-speaking] ${mappedJob.JobTitle}`);
    } else if (aiResult.german_required === true) {
        finalDecision = "rejected";
        rejectionReason = "German language required";
        console.log(`❌ [Rejected - German Required] ${mappedJob.JobTitle}`);
    } else {
        console.log(`✅ [Valid Job] ${mappedJob.JobTitle} (Confidence: ${aiResult.confidence})`);
    }
    
    // ✅ 8. SAVE TO TEST LOG (ALL JOBS - ACCEPTED + REJECTED)
    const testLogData = {
        ...mappedJob,
        EnglishSpeaking: aiResult.english_speaking,
        GermanRequired: aiResult.german_required,
        LocationClassification: aiResult.location_classification,
        Domain: aiResult.domain,
        SubDomain: aiResult.sub_domain,
        ConfidenceScore: aiResult.confidence,
        Evidence: aiResult.evidence, // ✅ NEW: AI reasoning
        FinalDecision: finalDecision, // ✅ NEW: "accepted" or "rejected"
        RejectionReason: rejectionReason, // ✅ NEW: Why rejected
        Status: finalDecision === "accepted" ? "pending_review" : "rejected"
    };
    
    const jobTestLog = createJobTestLog(testLogData, siteConfig.siteName);
    await saveJobTestLog(jobTestLog);
    console.log(`📝 [Test Log] Saved ${finalDecision} job: ${mappedJob.JobTitle}`);
    
    // ✅ 9. RETURN NULL IF REJECTED (don't save to main jobs collection)
    if (finalDecision === "rejected") {
        return null; // ✅ DO NOT SAVE TO MAIN COLLECTION
    }

    // If we reach here, job is valid and accepted!
    // ✅ ANALYTICS 3: Valid job found
    await Analytics.increment('jobsPendingReview');

    // 10. Create Model with all AI metadata (for main collection)
    mappedJob.EnglishSpeaking = aiResult.english_speaking;
    mappedJob.GermanRequired = aiResult.german_required;
    mappedJob.LocationClassification = aiResult.location_classification;
    mappedJob.Domain = aiResult.domain;
    mappedJob.SubDomain = aiResult.sub_domain;
    mappedJob.ConfidenceScore = aiResult.confidence;
    mappedJob.Status = "pending_review"; // All valid jobs go to review queue

    return createJobModel(mappedJob, siteConfig.siteName);
}