// grokAnalyzer.js
import Groq from "groq-sdk";
import { GROQ_API_KEY } from './env.js';
import { sleep } from './src/utils.js';

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

/**
 * ✅ FINAL VERSION: AI acts as an expert recruiter to estimate experience.
 */
export async function getJobDetails(description, title) {
    if (!description) return { estimatedYearsExperience: null };

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const completion = await groq.chat.completions.create({
                model: "llama-3.1-8b-instant",
                messages: [
                    { role: "system", content: "You are an expert HR analyst that returns ONLY a valid JSON object." },
                    {
                        role: "user",
                        content: `Analyze the following job title and description. Return a JSON object with one key: "estimatedYearsExperience".

- Your estimate must be an integer representing the minimum years of professional experience required, based on your expert knowledge of common industry standards.
- Consider the seniority implied by the title and the responsibilities in the description.
- If the role is clearly for an intern, a trainee, or an entry-level position, return 0.
- If the description is too vague or contradictory to make a reasonable estimate, return null.

TITLE: "${title}"
---
DESCRIPTION:
${description}`
                    },
                ],
                temperature: 0.1, max_tokens: 80, response_format: { type: "json_object" },
            });

            const rawContent = completion.choices[0]?.message?.content;
            if (!rawContent) throw new Error("Groq returned an empty response.");
            
            const result = JSON.parse(rawContent);
            return {
                estimatedYearsExperience: result.estimatedYearsExperience === undefined ? null : result.estimatedYearsExperience
            };
        } catch (err) {
            if (err.status === 429 && attempt < MAX_RETRIES) {
                const retryAfterMatch = err.message.match(/Please try again in ([\d.]+)/);
                const retryAfter = retryAfterMatch ? parseFloat(retryAfterMatch[1]) * 1000 + 500 : 5000;
                console.warn(`[AI] Rate limit hit on details check. Retrying in ${retryAfter / 1000}s...`);
                await sleep(retryAfter);
            } else {
                console.error(`Groq details analysis failed after ${attempt} attempts: ${err.message}`);
                return { estimatedYearsExperience: null };
            }
        }
    }
    return { estimatedYearsExperience: null };
}