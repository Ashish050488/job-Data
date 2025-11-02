// grokAnalyzer.js
import Groq from "groq-sdk";
import { GROQ_API_KEY } from './env.js';
import { sleep } from './utils.js';

const groq = new Groq({ apiKey: GROQ_API_KEY });
const MAX_RETRIES = 3;

export async function isGermanRequired(description) {
    if (!description) return false;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const snippetLength = 1500;
            let descriptionSnippet = description;
            if (description.length > snippetLength * 2) {
                descriptionSnippet = `${description.substring(0, snippetLength)} ... ${description.substring(description.length - snippetLength)}`;
            }

            const completion = await groq.chat.completions.create({
                model: "llama-3.1-8b-instant",
                messages: [
                    { role: "system", content: "You analyze job postings for language requirements." },
                    { role: "user", content: `Is German a required or essential language for this job description? Your answer must be ONLY "Yes" or "No".\n\n---\n\n${descriptionSnippet}` },
                ],
                temperature: 0.1, max_tokens: 5,
            });
            const answer = completion.choices[0]?.message?.content?.trim().toLowerCase();
            return answer.includes('yes');
        } catch (err) {
            if (err.status === 429 && attempt < MAX_RETRIES) {
                const retryAfterMatch = err.message.match(/Please try again in ([\d.]+)/);
                const retryAfter = retryAfterMatch ? parseFloat(retryAfterMatch[1]) * 1000 + 500 : 5000;
                console.warn(`[AI] Rate limit hit on German check. Retrying in ${retryAfter / 1000}s...`);
                await sleep(retryAfter);
            } else {
                console.error(`Groq German check failed after ${attempt} attempts: ${err.message}`);
                return false;
            }
        }
    }
    return false;
}


