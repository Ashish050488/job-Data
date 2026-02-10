import Groq from "groq-sdk";
import { GROQ_API_KEY } from './env.js';
import { sleep } from './utils.js';

const groq = new Groq({ apiKey: GROQ_API_KEY });

// Using the most versatile model. 
// Fallback could be "llama-3.1-8b-instant" if this one is consistently overloaded.
const MODEL_NAME = "llama-3.1-8b-instant"; 

const MAX_RETRIES = 5; // Increased retries since we are waiting smarter now

/**
 * Analyzes a job description using Groq (Llama 3) to determine quality.
 */
export async function analyzeJobWithGroq(jobTitle, description, locationRaw) {
    if (!description || description.length < 50) return null;

    // Truncate to save tokens but keep enough context
    const descriptionSnippet = description.substring(0, 4000);

    const prompt = `
    You are a strict job classification engine. 
    Analyze the following Job Title and Description snippet.
    
    JOB TITLE: "${jobTitle}"
    LOCATION RAW: "${locationRaw}"
    DESCRIPTION: "${descriptionSnippet}..."

    --- 🧠 CLASSIFICATION RULES (READ CAREFULLY) ---

    1. LOCATION (MOST IMPORTANT - CHECK THIS FIRST):
       
       🚨 CRITICAL RULE FOR MULTI-LOCATION JOBS:
       If LOCATION RAW contains MULTIPLE cities separated by ";", "/", "or", or "and":
       - Check if AT LEAST ONE is a German city
       - If YES → classify as "Germany" (candidate can choose to work from German location)
       - If NO → classify as "Not Germany"
       - Examples:
         * "Berlin; Paris" → "Germany" ✅ (Berlin is German)
         * "Munich/London" → "Germany" ✅ (Munich is German)
         * "Berlin or Vienna" → "Germany" ✅ (Berlin is German)
         * "London; Paris" → "Not Germany" ❌ (no German cities)
       
       STEP 1: CHECK FOR GERMAN CITIES IN LOCATION RAW
       German cities include: Berlin, Munich, Hamburg, Frankfurt, Cologne, Stuttgart, Düsseldorf, 
       Dortmund, Essen, Leipzig, Dresden, Hanover, Nuremberg, Duisburg, Bochum, Wuppertal, 
       Bielefeld, Bonn, Münster, Karlsruhe, Mannheim, Augsburg, Wiesbaden
       
       - If LOCATION RAW contains ANY German city → "Germany" ✅
       - Even if it also lists non-German cities (Berlin; Paris, Munich/London, etc.)
       
       STEP 2: CHECK FOR NON-GERMAN ONLY LOCATIONS
       - If LOCATION RAW contains ONLY non-German cities → "Not Germany"
       - Examples: London, Paris, Vienna, Zurich, Amsterdam, Madrid, Rome, Milan, etc.
       
       STEP 3: CHECK DESCRIPTION FOR LOCATION RESTRICTIONS
       - If description says "MUST be based in [Non-German City]" → "Not Germany"
       - If description says "EXCLUSIVELY [Non-German Country]" → "Not Germany"
       - If Remote but restricted to non-German country → "Not Germany"
       
       STEP 4: REMOTE JOBS
       - If "Remote" with no country restriction → check description
       - If "Remote - Germany" or "Remote within Germany" → "Germany"
       - If "Remote - EU" or "Remote - Europe" → "Germany" (if no other restrictions)
       
       OUTPUT:
       - "Germany": If AT LEAST ONE German city/location option is available
       - "Not Germany": If NO German location options (all cities are non-German)
       - "Unclear": If location info is missing or ambiguous

    2. ENGLISH SPEAKING:
       - TRUE: The job is conducted in English as the primary working language. Indicators include:
         * "English is the working language"
         * "English-speaking environment"
         * "All communication in English"
         * Description is primarily in English AND does not require German
         * "International team" with English mentioned
         * "Fluent English required" or "Native English speaker"
       
       - FALSE: The job requires German as the primary working language OR is not clearly English-speaking:
         * Job description is primarily in German
         * No mention of English being the working language
         * Ambiguous language requirements

    3. GERMAN REQUIRED:
       - TRUE (Mandatory): ONLY if the text explicitly says:
         * "German is mandatory"
         * "Fluent German required"
         * "Must speak German"
         * "Deutschkenntnisse erforderlich"
         * "Verhandlungssicher Deutsch"
         * "C1/C2 German level"
         * "German is required"
         * Job description is primarily in German language
       
       - FALSE (English Friendly): If the text says:
         * "German is a plus" / "nice to have" / "beneficial" / "advantage"
         * "English is the working language"
         * "No German skills required"
         * OR if German is NOT mentioned at all.
       
       - CRITICAL RULE: If both "English required" AND "German is a plus" appear, then german_required = FALSE.

    4. DOMAIN:
       - "Technical": Software, Data, AI, DevOps, QA, IT Infrastructure.
       - "Non-Technical": Product, Project Mgmt, Sales, Marketing, HR, Finance, Operations.
       - "Unclear": If ambiguous.

    5. SUB-DOMAIN:
       - Tech: Frontend, Backend, Full Stack, Data, AI, Mobile, DevOps, Security.
       - Non-Tech: Product, Project, Sales, Marketing, HR, Finance, Legal, Operations.

    6. CONFIDENCE SCORE (0.0 - 1.0):
       - How certain are you this is an English-speaking job located in Germany?
       - If location is "Remote" but country is unclear -> Low confidence (0.6).
       - If "German is a plus" AND "English is working language" -> High confidence (0.9).

    --- OUTPUT FORMAT ---
    Return ONLY valid JSON. No Markdown. No text.
    {
      "location_classification": "Germany" | "Not Germany" | "Unclear",
      "english_speaking": true | false,
      "german_required": true | false,
      "domain": "String",
      "sub_domain": "String",
      "confidence": Number,
      "evidence": {
        "location_reason": "Brief explanation of why you classified the location this way",
        "english_reason": "Brief explanation of why you classified english_speaking this way",
        "german_reason": "Brief explanation of why you classified german_required this way"
      }
    }
    
    EVIDENCE RULES:
    - Keep each reason to 2-3 sentences max
    - QUOTE EXACT TEXT from the job data using quotes ""
    - Always show WHERE you found the information (LOCATION RAW vs DESCRIPTION)
    - Be specific and verifiable
    
    EXAMPLES:
    
    Location Evidence:
    - Good: "LOCATION RAW field contains: 'Berlin; Paris'. Berlin is a German city, so classified as Germany."
    - Bad: "Location mentions Berlin which is in Germany"
    
    English Evidence:
    - Good: "Description contains exact phrase: 'English is the working language'. Classified as English-speaking."
    - Good: "Description is written in English and contains: 'All communication in English'. No German mentioned."
    - Bad: "Job says English is required"
    
    German Evidence:
    - Good: "Description contains: 'Fluent German required'. Classified as German required."
    - Good: "Description contains: 'German is a plus but not mandatory'. Classified as German NOT required."
    - Good: "No mention of German language in LOCATION RAW or DESCRIPTION. Classified as German NOT required."
    - Bad: "German not mentioned"
    
    CRITICAL: Always include EXACT QUOTES in "double quotes" so user can verify by searching the job description.
    `;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const chatCompletion = await groq.chat.completions.create({
                messages: [
                    { role: "system", content: "You are a JSON-only API. You must return pure JSON." },
                    { role: "user", content: prompt }
                ],
                model: MODEL_NAME,
                temperature: 0.1, 
                response_format: { type: "json_object" } 
            });

            const content = chatCompletion.choices[0]?.message?.content;
            if (!content) throw new Error("Empty response from Groq");

            const data = JSON.parse(content);
            
            // ✅ NORMALIZE TYPES: Ensure booleans are actual booleans, not strings
            const normalizedData = {
                location_classification: data.location_classification,
                english_speaking: data.english_speaking === true || data.english_speaking === "true",
                german_required: data.german_required === true || data.german_required === "true",
                domain: data.domain,
                sub_domain: data.sub_domain,
                confidence: Number(data.confidence) || 0,
                evidence: data.evidence || {
                    location_reason: "No reason provided",
                    english_reason: "No reason provided",
                    german_reason: "No reason provided"
                }
            };
            
            console.log(`[AI] ${jobTitle.substring(0, 20)}... | Eng: ${normalizedData.english_speaking} | Ger: ${normalizedData.german_required} | Loc: ${normalizedData.location_classification}`);
            return normalizedData;

        } catch (err) {
            // --- SMART RATE LIMIT HANDLING ---
            if (err.status === 429 || err.message.includes('429')) {
                let waitTime = 60000; // Default fallback: 60s

                // 1. Try to read 'retry-after' header directly
                if (err.headers && err.headers['retry-after']) {
                    const retryHeader = parseInt(err.headers['retry-after'], 10);
                    if (!isNaN(retryHeader)) {
                        waitTime = (retryHeader * 1000) + 1000; // Add 1s buffer
                    }
                } 
                // 2. Try to parse "Please try again in X.XXs" from error message
                else {
                    const match = err.message.match(/try again in ([\d.]+)s/);
                    if (match && match[1]) {
                        waitTime = Math.ceil(parseFloat(match[1]) * 1000) + 1000; // Add 1s buffer
                    }
                }

                console.warn(`[AI] Groq Rate Limit. Waiting exactly ${waitTime/1000}s...`);
                await sleep(waitTime);
                // Continue loop to retry immediately after waking up
            } else {
                console.warn(`[AI] Error: ${err.message}`);
                if (attempt === MAX_RETRIES) return null;
                await sleep(2000);
            }
        }
    }
    return null;
}

export async function isGermanRequired(description, jobTitle) {
    const result = await analyzeJobWithGroq(jobTitle, description, "Unknown");
    return result ? result.german_required : true; 
}