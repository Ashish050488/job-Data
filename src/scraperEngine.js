// src/scraperEngine.js
import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';
import { analyzeJobDescription } from "../grokAnalyzer.js";

export async function scrapeSite(siteConfig, existingIDsMap) {
    const siteName = siteConfig.siteName;
    const existingIDs = existingIDsMap.get(siteName) || new Set();
    const newJobsFound = [];
    
    const limit = 20;
    let offset = 0;
    let hasMore = true;

    console.log(`\n--- Starting scrape for [${siteName}] ---`);

    let sessionHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
    };
    if (siteConfig.needsSession) {
        try {
            console.log(`[${siteName}] Initializing session...`);
            const res = await fetch(siteConfig.baseUrl, { headers: sessionHeaders });
            const cookie = res.headers.get('set-cookie');
            if (cookie) {
                sessionHeaders['Cookie'] = cookie;
            }
        } catch (error) {
            console.error(`[${siteName}] FAILED to initialize session: ${error.message}. Aborting.`);
            return [];
        }
    }

    while (hasMore) {
        try {
            const fetchOptions = {
                method: siteConfig.method,
                headers: { ...sessionHeaders, "Content-Type": "application/json" },
            };

            if (siteConfig.method === 'POST') {
                fetchOptions.body = JSON.stringify(siteConfig.getBody(offset, limit, siteConfig.filterKeywords));
            }

            const res = await fetch(siteConfig.apiUrl, fetchOptions);
            if (!res.ok) throw new Error(`API error: ${res.status}`);
            
            const data = await res.json();
            const jobs = siteConfig.getJobs(data);

            if (jobs.length < limit || siteConfig.method === 'GET') {
                hasMore = false;
            }

            for (const rawJob of jobs) {
                let mappedJob = siteConfig.mapper(rawJob);

                if (siteConfig.filterKeywords && siteConfig.filterKeywords.length > 0) {
                    const title = mappedJob.JobTitle.toLowerCase();
                    const hasKeyword = siteConfig.filterKeywords.some(kw => title.includes(kw.toLowerCase()));
                    if (!hasKeyword) continue;
                }

                if (!mappedJob.JobID || existingIDs.has(mappedJob.JobID)) {
                    continue;
                }

                if (siteConfig.needsDescriptionScraping) {
                    try {
                        if (siteConfig.getDetails) {
                            console.log(`[${siteName}] Fetching details from API for job: ${mappedJob.JobID}`);
                            // ✅ THE FINAL FIX: Pass the entire 'rawJob' object and the session headers.
                            const details = await siteConfig.getDetails(rawJob, sessionHeaders); 
                            if (details.skip) continue;
                            mappedJob = { ...mappedJob, ...details };
                        } else {
                            console.log(`[${siteName}] Visiting job page for details: ${mappedJob.ApplicationURL}`);
                            const jobPageRes = await fetch(mappedJob.ApplicationURL, {
                                headers: {
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
                                    'Referer': siteConfig.refererUrl || siteConfig.apiUrl
                                }
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
        }
    }

    if (newJobsFound.length > 0) {
        console.log(`[${siteName}] Finished. Found ${newJobsFound.length} new jobs.`);
    } else {
        console.log(`[${siteName}] No new jobs found.`);
    }
    return newJobsFound;
}