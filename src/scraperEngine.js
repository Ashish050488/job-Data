// src/scraperEngine.js
import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';
import { analyzeJobDescription } from "../grokAnalyzer.js";
import { AbortController } from 'abort-controller';
export async function scrapeSite(siteConfig, existingIDsMap) {
    const siteName = siteConfig.siteName;
    const existingIDs = existingIDsMap.get(siteName) || new Set();
    const newJobsFound = [];
    
    const limit = 20;
    let offset = 0;
    let hasMore = true;
    let totalJobs = 0;

    console.log(`\n--- Starting scrape for [${siteName}] ---`);

    let sessionHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
    };
    if (siteConfig.needsSession) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        try {
            console.log(`[${siteName}] Initializing session...`);
            const res = await fetch(siteConfig.baseUrl, { headers: sessionHeaders, signal: controller.signal });
            const cookie = res.headers.get('set-cookie');
            if (cookie) {
                sessionHeaders['Cookie'] = cookie;
            }
        } catch (error) {
            console.error(`[${siteName}] FAILED to initialize session: ${error.message}. Aborting.`);
            return [];
        } finally {
            clearTimeout(timeoutId);
        }
    }

    while (hasMore) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        try {
            const fetchOptions = {
                method: siteConfig.method,
                headers: { ...sessionHeaders, "Content-Type": "application/json" },
                signal: controller.signal
            };

            let currentApiUrl = siteConfig.apiUrl;

            if (siteConfig.method === 'POST') {
                fetchOptions.body = JSON.stringify(siteConfig.getBody(offset, limit, siteConfig.filterKeywords));
            } else if (siteConfig.method === 'GET') {
                if (typeof siteConfig.buildPageUrl === 'function') {
                    currentApiUrl = siteConfig.buildPageUrl(offset, limit, siteConfig.filterKeywords);
                }
            }

            const res = await fetch(currentApiUrl, fetchOptions);
            if (!res.ok) throw new Error(`API error: ${res.status}`);
            
            const data = await res.json();
            const jobs = siteConfig.getJobs(data);

            if (jobs.length === 0) {
                hasMore = false;
            } else if (siteConfig.getTotal) {
                if (offset === 0) totalJobs = siteConfig.getTotal(data);
                if ((offset + jobs.length) >= totalJobs) {
                    hasMore = false;
                }
            } else if (siteConfig.ignoreLengthCheck) {
                // Keep going until jobs.length is 0
            } else if (jobs.length < limit) {
                hasMore = false;
            }

            for (const rawJob of jobs) {
                let mappedJob = siteConfig.mapper(rawJob);

                const title = mappedJob.JobTitle.toLowerCase();
                if (siteConfig.filterKeywords && siteConfig.filterKeywords.length > 0) {
                    const description = mappedJob.Description.toLowerCase();
                    const textToSearch = title + ' ' + description;
                    const hasPositiveKeyword = siteConfig.filterKeywords.some(kw => textToSearch.includes(kw.toLowerCase()));
                    if (!hasPositiveKeyword) continue;
                }
                if (siteConfig.negativeKeywords && siteConfig.negativeKeywords.length > 0) {
                    const hasNegativeKeyword = siteConfig.negativeKeywords.some(kw => title.includes(kw.toLowerCase()));
                    if (hasNegativeKeyword) continue;
                }

                if (!mappedJob.JobID || existingIDs.has(mappedJob.JobID)) {
                    continue;
                }

                if (siteConfig.needsDescriptionScraping) {
                   try {
                        if (siteConfig.getDetails) {
                            console.log(`[${siteName}] Fetching details from API for job: ${mappedJob.JobID}`);
                            const details = await siteConfig.getDetails(rawJob, sessionHeaders);
                            if (details.skip) continue;
                            mappedJob = { ...mappedJob, ...details };
                        } else {
                            // --- START: This is the full logic that was abbreviated before ---
                            console.log(`[${siteName}] Visiting job page for details: ${mappedJob.ApplicationURL}`);
                            const pageController = new AbortController();
                            const pageTimeoutId = setTimeout(() => pageController.abort(), 30000);
                            try {
                                const jobPageRes = await fetch(mappedJob.ApplicationURL, {
                                    headers: {
                                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
                                        'Referer': siteConfig.refererUrl || siteConfig.apiUrl
                                    },
                                    signal: pageController.signal
                                });
                                const html = await jobPageRes.text();
                                const dom = new JSDOM(html);
                                const descriptionElements = dom.window.document.querySelectorAll(siteConfig.descriptionSelector);
                                if (descriptionElements && descriptionElements.length > 0) {
                                    for (const element of descriptionElements) {
                                        const text = element.textContent.trim();
                                        if (text) {
                                            mappedJob.Description = text.replace(/\s+/g, ' ');
                                            break;
                                        }
                                    }
                                }
                                const locationElement = dom.window.document.querySelector(siteConfig.locationSelector);
                                if (locationElement) {
                                    mappedJob.Location = locationElement.textContent.replace(/\s+/g, ' ').trim();
                                }
                            } finally {
                                clearTimeout(pageTimeoutId);
                            }
                            // --- END: Full logic is now included ---
                        }
                    } catch (pageError) {
                        console.error(`[${siteName}] Failed to get details for job ${mappedJob.JobID}: ${pageError.message}`);
                        continue;
                    }
                }

                console.log(`[${siteName}] New job found: ${mappedJob.JobID}. Analyzing...`);
                const aiResult = await analyzeJobDescription(mappedJob.Description);
                const finalJobData = { ...mappedJob, GermanRequired: String(aiResult.germanRequired || "N/A"), Summary: String(aiResult.summary || ""), siteName: siteName };
                
                newJobsFound.push(finalJobData);
                existingIDs.add(finalJobData.JobID);
            }
            offset += limit;

        } catch (error) {
            console.error(`[${siteName}] ERROR during scrape: ${error.message}.`);
            hasMore = false;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    if (newJobsFound.length > 0) {
        console.log(`[${siteName}] Finished. Found ${newJobsFound.length} new jobs.`);
    } else {
        console.log(`[${siteName}] No new jobs found.`);
    }
    return newJobsFound;
}