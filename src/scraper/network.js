import fetch from 'node-fetch';
import { AbortController } from 'abort-controller';

/**
 * Initializes a session for sites that require cookies.
 * @param {object} siteConfig - The configuration for the site.
 * @returns {Promise<object>} The session headers with the cookie.
 */
export async function initializeSession(siteConfig) {
    const sessionHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
    };
    if (!siteConfig.needsSession) return sessionHeaders;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
        console.log(`[${siteConfig.siteName}] Initializing session...`);
        const res = await fetch(siteConfig.baseUrl, { headers: sessionHeaders, signal: controller.signal });
        const cookie = res.headers.get('set-cookie');
        if (cookie) {
            sessionHeaders['Cookie'] = cookie;
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
 * @param {object} siteConfig - The configuration for the site.
 * @param {number} offset - The current pagination offset.
 * @param {number} limit - The number of items per page.
 * @param {object} sessionHeaders - The headers for the request.
 * @returns {Promise<object>} The JSON response from the API.
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

