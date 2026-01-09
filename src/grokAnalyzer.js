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

    1. LOCATION: 
       - "Germany": If explicitly mentioned, or specific German cities (Berlin, Munich, Hamburg, etc.), or Remote ONLY if restricted to Germany.
       - "Not Germany": If another country is named (e.g., "Austria", "Switzerland", "UK"), or "Global/EMEA" without Germany.
       - "Unclear": If no location is found.

    2. LANGUAGE (German Required?):
       - TRUE (Mandatory): ONLY if the text explicitly says:
         * "German is mandatory"
         * "Fluent German required"
         * "Must speak German"
         * "Deutschkenntnisse erforderlich"
         * "Verhandlungssicher Deutsch"
         * "C1/C2 German level"
       
       - FALSE (English Friendly): If the text says:
         * "German is a plus" / "nice to have" / "beneficial" / "advantage"
         * "English is the working language"
         * "No German skills required"
         * OR if German is NOT mentioned at all.
       
       - CRITICAL RULE: If both "English required" AND "German is a plus" appear, then german_required = FALSE.

    3. DOMAIN:
       - "Technical": Software, Data, AI, DevOps, QA, IT Infrastructure.
       - "Non-Technical": Product, Project Mgmt, Sales, Marketing, HR, Finance, Operations.
       - "Unclear": If ambiguous.

    4. SUB-DOMAIN:
       - Tech: Frontend, Backend, Full Stack, Data, AI, Mobile, DevOps, Security.
       - Non-Tech: Product, Project, Sales, Marketing, HR, Finance, Legal, Operations.

    5. CONFIDENCE SCORE (0.0 - 1.0):
       - How certain are you this is an English-speaking job located in Germany?
       - If location is "Remote" but country is unclear -> Low confidence (0.6).
       - If "German is a plus" -> High confidence (0.9).

    --- OUTPUT FORMAT ---
    Return ONLY valid JSON. No Markdown. No text.
    {
      "location_classification": "Germany" | "Not Germany" | "Unclear",
      "german_required": true | false,
      "domain": "String",
      "sub_domain": "String",
      "confidence": Number
    }
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
            
            console.log(`[AI] ${jobTitle.substring(0, 20)}... | Req: ${data.german_required} | Loc: ${data.location_classification}`);
            return data;

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