import Groq from "groq-sdk";
import { GROQ_API_KEY } from './env.js';
import { sleep } from './utils.js';

const groq = new Groq({ apiKey: GROQ_API_KEY });

const MODEL_NAME = "llama-3.1-8b-instant"; 
const MAX_RETRIES = 5;

/**
 * Analyzes a job description using Groq - EVIDENCE-BASED ONLY
 * No assumptions, only explicit proof
 */
export async function analyzeJobWithGroq(jobTitle, description, locationRaw) {
    if (!description || description.length < 50) return null;

    const descriptionSnippet = description.substring(0, 4000);

  const prompt = `
You are a strict evidence-only classifier.
You MUST NOT infer anything that is not explicitly stated in the provided text.

JOB TITLE: "${jobTitle}"
LOCATION RAW: "${locationRaw}"
DESCRIPTION: "${descriptionSnippet}..."

--- 🚨 ABSOLUTE RULES (CRITICAL) ---

1) Do NOT use the language of the description (English/German) as evidence for english_speaking or german_required.
2) Only mark a field TRUE if there is EXPLICIT proof in the text.
3) If explicit proof is missing, mark the field FALSE.
4) Evidence MUST contain EXACT QUOTES from LOCATION RAW or DESCRIPTION.
   - Use double quotes "" to show the exact text
   - Do NOT paraphrase or summarize
   - Do NOT invent quotes
5) If you cannot find a quote, write: "No explicit statement found in DESCRIPTION."

--- LOCATION CLASSIFICATION ---

Classify as "Germany" if LOCATION RAW contains ANY of:
- German city names: Berlin, Munich, Hamburg, Frankfurt, Cologne, Stuttgart, Düsseldorf, 
  Dortmund, Essen, Leipzig, Dresden, Hanover, Nuremberg, Leverkusen, Bomlitz, Dormagen, 
  Brunsbüttel, Krefeld, Meppen, Aachen, etc.
- Country indicators: "Germany", "Deutschland", "DE", "German"
- Remote in Germany: "Remote - Germany", "Remote (Germany)", "Homeoffice Deutschland"
- State names: "North Rhine-Westphalia", "Lower Saxony", "Bavaria", "Schleswig-Holstein"

Classify as "Not Germany" if LOCATION RAW contains ONLY non-German locations:
- London, Paris, Vienna, Zurich, Amsterdam, Madrid, etc.
- AND no German city or "Germany" is mentioned

Classify as "Unclear" if:
- LOCATION RAW is empty, "N/A", or ambiguous like "Remote" without country

--- ENGLISH-SPEAKING (english_speaking boolean) ---

Set english_speaking = TRUE if you find EXPLICIT evidence that English is required OR is the working language.

Accepted explicit proofs (find at least ONE of these):
- "English is the working language"
- "Working language: English"
- "Business language is English"  
- "All communication in English"
- "Fluent English required"
- "Proficient English required"
- "Excellent English skills"
- "Native English speaker"
- "You have fluent English skills"
- "Strong command of English"
- "English proficiency required"
- "fluent English skills in speaking and writing"
- "English (C1)" or any English level mentioned
- "International team" + "English" mentioned as requirement
- "English-speaking environment"

Set english_speaking = FALSE if:
- No explicit English requirement found (even if description is in English)
- OR German is stated as the working language AND English is not mentioned



--- GERMAN REQUIRED (german_required boolean) ---

Set german_required = TRUE ONLY if you find EXPLICIT PROOF that German is MANDATORY/REQUIRED.

🚨 ABSOLUTE RULE: Do NOT make assumptions based on phrasing or cultural context.
ONLY mark TRUE if you see explicit requirement keywords.

EXPLICIT PROOF = Find at least ONE of these REQUIREMENT KEYWORDS:

A) MANDATORY KEYWORDS (in German):
- "erforderlich" (required) - e.g., "Deutschkenntnisse erforderlich"
- "notwendig" (necessary) - e.g., "Deutsch notwendig"
- "vorausgesetzt" (prerequisite) - e.g., "Fließend Deutsch vorausgesetzt"
- "zwingend" (mandatory) - e.g., "Deutsch zwingend erforderlich"
- "Pflicht" (mandatory/must) - e.g., "Deutsche Sprache ist Pflicht"
- "erforderliche" (required) - e.g., "erforderliche Deutschkenntnisse"

B) MANDATORY KEYWORDS (in English):
- "required" - e.g., "German required", "German skills required"
- "must" - e.g., "must speak German", "must have German"
- "mandatory" - e.g., "German is mandatory"
- "essential" - e.g., "German is essential"
- "necessary" - e.g., "German is necessary"

C) EXPLICIT LANGUAGE LEVELS (indicates requirement):
- CEFR levels: "B1", "B2", "C1", "C2"
- With requirement context: "German (B2)", "Deutsch (C1)", "mindestens B2", "at least C1"

D) BILINGUAL REQUIREMENTS (both needed):
- "und" between languages: "Deutsch und Englisch"
- "and" between languages: "English and German" / "German and English"
- ANY form of both languages listed together:
  * "Fluent in English and German"
  * "Fluent in German and English"
  * "English and German required"
  * "German and English required"
  * "both English and German"
  * "both German and English"
- Communication in both: "auf Deutsch und Englisch kommunizieren"

🚨 CRITICAL: If you see BOTH "English" and "German" (or "Englisch" and "Deutsch") 
connected by "and" (or "und"), this means BOTH are required → german_required = TRUE.

🚨 CRITICAL: Do NOT assume German is not required just because the job description is written in English.

E) WORKING LANGUAGE STATEMENTS:
- "working language" - e.g., "German is the working language", "Deutsch als Arbeitssprache"
- "business language" - e.g., "German is the business language"

---

Set german_required = FALSE if:

A) OPTIONAL KEYWORDS:
- "von Vorteil" (advantageous)
- "wünschenswert" (desirable)
- "nice to have"
- "a plus"
- "beneficial"
- "von Nutzen" (useful)
- "hilfreich" (helpful)

B) POLITE PHRASING (NOT explicit requirement):
- "runden dein Profil ab" (round out your profile) ← NOT explicit!
- "abrunden" (round out) ← NOT explicit!
- "ergänzen" (complement) ← NOT explicit!

C) NO MENTION:
- German is not mentioned anywhere in DESCRIPTION

🚨 CRITICAL EXAMPLES:

MARK TRUE (has explicit requirement keyword):
✅ "Deutschkenntnisse erforderlich" → TRUE (has "erforderlich")
✅ "Fließend Deutsch vorausgesetzt" → TRUE (has "vorausgesetzt")
✅ "German (B2 minimum)" → TRUE (has level = requirement)
✅ "Deutsch und Englisch" → TRUE (has "und" = both needed)
✅ "German is mandatory" → TRUE (has "mandatory")
✅ "Fluent in English and German" → TRUE (has "and" = both needed)
✅ "English and German required" → TRUE (has "and" + "required")

MARK FALSE (NO explicit requirement keyword):
❌ "Sehr gute Deutschkenntnisse runden dein Profil ab" → FALSE (only "runden ab", no "erforderlich")
❌ "Deutschkenntnisse" alone → FALSE (mentions skill but doesn't say required)
❌ "Gute Deutschkenntnisse" → FALSE (good skills, but not explicitly required)
❌ "German is a plus" → FALSE (explicitly optional)
❌ "You have fluent English skills" (no German mentioned) → FALSE

🚨 SPECIAL CASE - Bilingual Requirements:
"Fluent in English and German (additional languages are a plus)" → TRUE
Explanation: The "and" connects English and German, meaning BOTH are required. 
The "(additional languages are a plus)" refers to OTHER languages like Spanish, French, etc., not German.

🚨 DO NOT ASSUME: Just because German is mentioned doesn't mean it's required!
Only mark TRUE if you see explicit requirement keywords!

--- DOMAIN & SUB-DOMAIN ---

Domain:
- "Technical": Software, Data, AI, DevOps, Engineering, IT, Automation
- "Non-Technical": Product, Marketing, Sales, HR, Finance, Operations
- "Unclear": If ambiguous

Sub-domain: Be specific (e.g., "AI", "Backend", "Data Science", "DevOps", "Product Management", "Marketing")

--- CONFIDENCE SCORE (0.0 - 1.0) ---

High confidence (0.90-0.95):
- Location is clearly "Germany" with explicit city/country name
- english_speaking has explicit quote proving English requirement
- german_required determination has explicit evidence

Medium confidence (0.70-0.85):
- Location is clear but context-based
- english_speaking or german_required lacks perfect quote but context is strong

Low confidence (0.50-0.65):
- Any key field lacks explicit evidence
- Ambiguous location
- Unclear language requirements

--- EVIDENCE FORMAT (CRITICAL) ---

For each evidence field, provide:
1. WHERE you found the information (LOCATION RAW or DESCRIPTION)
2. EXACT QUOTE in "double quotes"
3. Brief explanation (1-2 sentences)

Examples:

Good location evidence:
"LOCATION RAW contains: 'Leverkusen' which is a German city, classified as Germany."

Good english evidence:
"DESCRIPTION contains exact phrase: 'You have fluent English skills in speaking and writing'. This explicitly requires English proficiency, classified as English-speaking."

Good german evidence (required - has explicit keyword):
"DESCRIPTION contains: 'Deutschkenntnisse erforderlich'. The word 'erforderlich' means required, classified as German required."

Another example:
"DESCRIPTION contains: 'Fluent in English and German (additional languages are a plus)'. The word 'and' indicates both languages are required, classified as German required."

Another example:
"DESCRIPTION contains: 'German (B2 minimum)'. Specifies B2 level which indicates requirement, classified as German required."

Good german evidence (NOT required - no explicit keyword):
"DESCRIPTION contains: 'Sehr gute Deutsch- und Englischkenntnisse runden dein Profil ab'. While German is mentioned, there is no explicit requirement keyword like 'erforderlich' or 'vorausgesetzt'. Classified as German NOT required."

Another example:
"No mention of German language in DESCRIPTION. Job only requires: 'fluent English skills'. Classified as German NOT required."

Another example:
"DESCRIPTION contains: 'German is a plus'. Explicitly states German is optional, classified as German NOT required."

Bad evidence (DO NOT DO THIS):
"Job requires English based on context" ← No quote!
"German is working language" ← Not an exact quote!

--- OUTPUT FORMAT ---

Return ONLY valid JSON (no markdown, no backticks):
{
  "location_classification": "Germany" | "Not Germany" | "Unclear",
  "english_speaking": true | false,
  "german_required": true | false,
  "domain": "String",
  "sub_domain": "String",
  "confidence": Number,
  "evidence": {
    "location_reason": "2-3 sentences with EXACT quotes in \\"double quotes\\"",
    "english_reason": "2-3 sentences with EXACT quotes in \\"double quotes\\"",
    "german_reason": "2-3 sentences with EXACT quotes in \\"double quotes\\""
  }
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
            
            // ✅ NORMALIZE TYPES
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
            if (err.status === 429 || err.message.includes('429')) {
                let waitTime = 60000;

                if (err.headers && err.headers['retry-after']) {
                    const retryHeader = parseInt(err.headers['retry-after'], 10);
                    if (!isNaN(retryHeader)) {
                        waitTime = (retryHeader * 1000) + 1000;
                    }
                } else {
                    const match = err.message.match(/try again in ([\d.]+)s/);
                    if (match && match[1]) {
                        waitTime = Math.ceil(parseFloat(match[1]) * 1000) + 1000;
                    }
                }

                console.warn(`[AI] Groq Rate Limit. Waiting ${waitTime/1000}s...`);
                await sleep(waitTime);
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