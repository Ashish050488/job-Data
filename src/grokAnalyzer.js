// src/grokAnalyzer.js
import Groq from "groq-sdk";
import { GROQ_API_KEY } from './env.js';
import { sleep } from './utils.js';

const groq = new Groq({ apiKey: GROQ_API_KEY });

// ✅ UPDATE: Switched to the latest supported model
const MODEL_NAME = "llama-3.3-70b-versatile"; 

const MAX_RETRIES = 3;

/**
 * Analyzes a job description using Groq to determine quality.
 */
export async function analyzeJobWithGroq(jobTitle, description, locationRaw) {
    if (!description || description.length < 50) return null;

    // Truncate to safe limit
    const descriptionSnippet = description.substring(0, 4000);

    const prompt = `
    You are a strict job classification engine. 
    Analyze the following Job Title and Description snippet.
    
    JOB TITLE: "${jobTitle}"
    LOCATION RAW: "${locationRaw}"
    DESCRIPTION: "${descriptionSnippet}..."

    --- CLASSIFICATION RULES ---

    1. LOCATION: 
       - "Germany": If explicitly mentioned, or German cities (Berlin, Munich, Hamburg, etc.), or Remote ONLY if restricted to Germany.
       - "Not Germany": If another country is named, or "Global/EMEA" without Germany.
       - "Unclear": If no location is found.

    2. LANGUAGE (German Required?):
       - TRUE (Mandatory): If "German required", "Deutsch erforderlich", "Fluent German", "C1/C2", "Muttersprache".
       - FALSE (English Friendly): If German is "nice to have", "plus", "optional", or English is the main working language.
       - IF UNSURE: Set to TRUE (Conservative safety).

    3. DOMAIN:
       - "Technical": Software, Data, AI, DevOps, QA, IT Infrastructure.
       - "Non-Technical": Product, Project Mgmt, Sales, Marketing, HR, Finance, Operations.
       - "Unclear": If ambiguous.

    4. SUB-DOMAIN:
       - Tech: Frontend, Backend, Full Stack, Data, AI, Mobile, DevOps, Security.
       - Non-Tech: Product, Project, Sales, Marketing, HR, Finance, Legal, Operations.

    5. CONFIDENCE SCORE (0.0 - 1.0):
       - How certain are you this is an English-speaking job located in Germany?

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
                temperature: 0.1, // Low temp for consistency
                response_format: { type: "json_object" } // Force JSON mode
            });

            const content = chatCompletion.choices[0]?.message?.content;
            if (!content) throw new Error("Empty response from Groq");

            const data = JSON.parse(content);
            
            console.log(`[AI] ${jobTitle.substring(0, 15)}... | Req: ${data.german_required} | Loc: ${data.location_classification}`);
            return data;

        } catch (err) {
            // Groq Rate Limit Handling (429)
            if (err.status === 429 || err.message.includes('429')) {
                console.warn(`[AI] Groq Rate Limit (Attempt ${attempt}). Waiting 20s...`);
                await sleep(20000); 
            } else {
                console.warn(`[AI] Error: ${err.message}`);
                if (attempt === MAX_RETRIES) return null;
                await sleep(2000);
            }
        }
    }
    return null;
}

// Keep generic wrapper for backward compatibility
export async function isGermanRequired(description, jobTitle) {
    const result = await analyzeJobWithGroq(jobTitle, description, "Unknown");
    return result ? result.german_required : true; 
}