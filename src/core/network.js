// src/scraper/network.js
import fetch from 'node-fetch';
import { AbortController } from 'abort-controller';

/**
 * ✅ FINAL VERSION: Initializes a session and correctly handles CSRF tokens.
 */
export async function initializeSession(siteConfig) {
    const sessionHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36'
    };
    if (!siteConfig.needsSession) return sessionHeaders;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
        console.log(`[${siteConfig.siteName}] Initializing session...`);
        const res = await fetch(siteConfig.baseUrl, { headers: sessionHeaders, signal: controller.signal });
        
        // This site sends multiple cookies; we need to read them all.
        const cookies = res.headers.raw()['set-cookie'];
        if (cookies) {
            // Join all cookies into a single string for the 'Cookie' header.
            sessionHeaders['Cookie'] = cookies.join('; ');

            // Find the specific XSRF-TOKEN from the array of cookies.
            const xsrfCookie = cookies.find(c => c.startsWith('XSRF-TOKEN='));
            if (xsrfCookie) {
                const token = xsrfCookie.split(';')[0].split('=')[1];
                // Add the required X-XSRF-TOKEN header for the POST request.
                sessionHeaders['X-XSRF-TOKEN'] = decodeURIComponent(token);
            }
        }
    } catch (error) {
        console.error(`[${siteConfig.siteName}] FAILED to initialize session: ${error.message}. Aborting.`);
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
    return sessionHeaders;
}

/**
 * Fetches a single page of job listings from an API.
 * (This function does not need to be changed)
 */
export async function fetchJobsPage(siteConfig, offset, limit, sessionHeaders) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
        const fetchOptions = {
            method: siteConfig.method,
            headers: {
                ...sessionHeaders,
                ...(siteConfig.customHeaders || {})
            },
            signal: controller.signal
        };

        let currentApiUrl = siteConfig.apiUrl;

        if (siteConfig.method === 'POST') {
            const bodyData = siteConfig.getBody(offset, limit, siteConfig.filterKeywords);
            
            if (typeof siteConfig.buildPageUrl === 'function') {
                currentApiUrl = siteConfig.buildPageUrl(offset, limit);
            }

            if (siteConfig.bodyType === 'form') {
                fetchOptions.headers['Content-Type'] = 'application/x-www-form-urlencoded';
                fetchOptions.body = new URLSearchParams(bodyData).toString();
            } else {
                fetchOptions.headers['Content-Type'] = 'application/json';
                fetchOptions.body = JSON.stringify(bodyData);
            }
        } else if (siteConfig.method === 'GET') {
            if (typeof siteConfig.buildPageUrl === 'function') {
                currentApiUrl = siteConfig.buildPageUrl(offset, limit, siteConfig.filterKeywords);
            }
        }

        const res = await fetch(currentApiUrl, fetchOptions);
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        
        return await res.json();
    } finally {
        clearTimeout(timeoutId);
    }
}