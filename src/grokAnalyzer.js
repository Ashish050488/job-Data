// grokAnalyzer.js
import Groq from "groq-sdk";
import { GROQ_API_KEY } from './env.js';
import { sleep } from './utils.js';

const groq = new Groq({ apiKey: GROQ_API_KEY });
const MAX_RETRIES = 3;

export async function isGermanRequired(description, jobTitle = "") {
    if (!description) return false;

    // --- NEW SNIPPET LOGIC: Find the language context ---
    const lowerDesc = description.toLowerCase();
    const keywordIndex = lowerDesc.indexOf('german') !== -1 ? lowerDesc.indexOf('german') : lowerDesc.indexOf('deutsch');
    
    let descriptionSnippet = description;
    if (description.length > 3000) {
        if (keywordIndex !== -1) {
            // Take 1500 chars around the keyword "German/Deutsch"
            const start = Math.max(0, keywordIndex - 750);
            const end = Math.min(description.length, keywordIndex + 750);
            descriptionSnippet = `... ${description.substring(start, end)} ...`;
        } else {
            // Fallback to start/end if keyword not found
            descriptionSnippet = `${description.substring(0, 1500)} ... ${description.substring(description.length - 1500)}`;
        }
    }

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const completion = await groq.chat.completions.create({
                model: "llama-3.1-8b-instant",
                messages: [
                    { 
                        role: "system", 
                        content: `You are a strict language-requirement classifier for job descriptions. Your task is to determine whether German language proficiency is a MANDATORY requirement.
                        
                        DEFINITION OF MANDATORY:
                        - Native/Mother tongue, Fluent, Business Fluent, or Professional Proficiency.
                        - Any CEFR level (A1-C2) tied to German.
                        - Phrases like: "German is mandatory", "must speak German", "Deutsch erforderlich", "zwingend erforderlich", "Muttersprache".

                        DEFINITION OF NOT MANDATORY (Answer "No"):
                        - German is not mentioned.
                        - German is "nice to have", "a plus", "advantage", "optional", or "preferred".
                        - The text states English is the working language and German is NOT required.

                        Decision Rule: Mandatory wording always overrides optional wording. If uncertain, prioritize the strongest obligation language.` 
                    },
                    { 
                        role: "user", 
                        content: `Job Title: ${jobTitle}\n\nDescription Snippet: ${descriptionSnippet}\n\nIs German a mandatory requirement? Return ONLY "Yes" or "No".` 
                    },
                ],
                temperature: 0.1, // Keep it low for consistency
                max_tokens: 5,
            });

            const answer = completion.choices[0]?.message?.content?.trim().toLowerCase();
            console.log(`[AI Check] ${jobTitle.substring(0, 30)}... -> ${answer}`);
            
            return answer.includes('yes');

        } catch (err) {
            if (err.status === 429 && attempt < MAX_RETRIES) {
                const retryAfterMatch = err.message.match(/Please try again in ([\d.]+)/);
                const retryAfter = retryAfterMatch ? parseFloat(retryAfterMatch[1]) * 1000 + 500 : 5000;
                console.warn(`[AI] Rate limit hit. Retrying in ${retryAfter / 1000}s...`);
                await sleep(retryAfter);
            } else {
                console.error(`Groq check failed: ${err.message}`);
                return false;
            }
        }
    }
    return false;
}