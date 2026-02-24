import Groq from "groq-sdk";
import { GROQ_API_KEY } from './env.js';
import { sleep } from './utils.js';

const groq = new Groq({ apiKey: GROQ_API_KEY });

const MODEL_NAME = "llama-3.1-8b-instant"; 
const MAX_RETRIES = 5;

/**
 * Analyzes a job description using Groq - GERMAN ONLY (NO LOCATION CHECK)
 */
export async function analyzeJobWithGroq(jobTitle, description) {
    if (!description || description.length < 50) return null;

    const descriptionSnippet = description.substring(0, 4000);

    const prompt = `
You are a strict evidence-only classifier for German language requirements.
You MUST NOT infer anything that is not explicitly stated in the provided text.

JOB TITLE: "${jobTitle}"
DESCRIPTION: "${descriptionSnippet}..."

--- 🚨 ABSOLUTE RULES (CRITICAL) ---

1) Do NOT use the language of the description (English/German) as evidence for german_required.
2) Only mark a field TRUE if there is EXPLICIT proof in the text.
3) If explicit proof is missing, mark the field FALSE.
4) Evidence MUST contain EXACT QUOTES from DESCRIPTION.
   - Use double quotes "" to show the exact text
   - Do NOT paraphrase or summarize
   - Do NOT invent quotes
5) If you cannot find a quote, write: "No explicit statement found in DESCRIPTION."

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
- "German required" - explicit statement
- "German skills required" - explicit statement
- "must speak German" - explicit must statement
- "must have German" - explicit must statement
- "German is mandatory" - explicit statement
- "German is essential" - explicit statement
- "German is necessary" - explicit statement

C) EXPLICIT LANGUAGE LEVELS (indicates requirement):
- CEFR levels with German: "German B1", "German B2", "German C1", "German C2"
- "Deutsch (B2)", "Deutsch (C1)", "mindestens B2", "at least C1"
- Level specifications indicate requirement

D) WORKING LANGUAGE STATEMENTS:
- "German is the working language"
- "Deutsch als Arbeitssprache"
- "German is the business language"
- "Arbeitssprache Deutsch"

E) FLUENCY REQUIREMENTS:
- "Fluent in German" or "Fluency in German" - indicates requirement
- "Fließend Deutsch" - indicates fluency requirement
- "Native German" or "Native-level German" - indicates requirement

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
✅ "German is mandatory" → TRUE (has "mandatory")
✅ "German required" → TRUE (has "required")
✅ "Fluency in German" → TRUE (fluency = requirement)
✅ "Fluent in German (mandatory)" → TRUE (explicit requirement)
✅ "Arbeitssprache Deutsch" → TRUE (working language)

MARK FALSE (NO explicit requirement keyword):
❌ "Sehr gute Deutschkenntnisse runden dein Profil ab" → FALSE (only "runden ab", no "erforderlich")
❌ "Deutschkenntnisse" alone → FALSE (mentions skill but doesn't say required)
❌ "Gute Deutschkenntnisse" → FALSE (good skills, but not explicitly required)
❌ "German is a plus" → FALSE (explicitly optional)
❌ "German would be nice" → FALSE (optional phrasing)

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
- german_required determination has explicit evidence (keyword found or proven absence)

Medium confidence (0.70-0.85):
- german_required lacks perfect quote but context is strong

Low confidence (0.50-0.65):
- Unclear language requirements

--- EVIDENCE FORMAT (CRITICAL) ---

For german_reason field, provide:
1. WHERE you found the information (DESCRIPTION)
2. EXACT QUOTE in "double quotes"
3. Brief explanation (1-2 sentences)

Examples:

Good german evidence (required - has explicit keyword):
"DESCRIPTION contains: 'Deutschkenntnisse erforderlich'. The word 'erforderlich' means required, classified as German required."

Another example:
"DESCRIPTION contains: 'Fluency in German & English (mandatory)'. The word 'Fluency' combined with 'mandatory' indicates German is required."

Another example:
"DESCRIPTION contains: 'German (B2 minimum)'. Specifies B2 level which indicates requirement, classified as German required."

Good german evidence (NOT required - no explicit keyword):
"DESCRIPTION contains: 'Sehr gute Deutschkenntnisse runden dein Profil ab'. While German is mentioned, there is no explicit requirement keyword like 'erforderlich' or 'vorausgesetzt'. Classified as German NOT required."

Another example:
"No mention of German language in DESCRIPTION. Classified as German NOT required."

Another example:
"DESCRIPTION contains: 'German is a plus'. Explicitly states German is optional, classified as German NOT required."

Bad evidence (DO NOT DO THIS):
"German is working language" ← Not an exact quote!
"Job prefers German speakers" ← Assumption, no quote!

--- OUTPUT FORMAT ---

Return ONLY valid JSON (no markdown, no backticks):
{
  "german_required": true | false,
  "domain": "String",
  "sub_domain": "String",
  "confidence": Number,
  "evidence": {
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
            
            const normalizedData = {
                german_required: data.german_required === true || data.german_required === "true",
                domain: data.domain,
                sub_domain: data.sub_domain,
                confidence: Number(data.confidence) || 0,
                evidence: data.evidence || {
                    german_reason: "No reason provided"
                }
            };
            
            console.log(`[AI] ${jobTitle.substring(0, 20)}... | Ger: ${normalizedData.german_required}`);
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
    const result = await analyzeJobWithGroq(jobTitle, description);
    return result ? result.german_required : true; 
}