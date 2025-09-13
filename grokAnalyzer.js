// grokAnalyzer.js
import Groq from "groq-sdk";
import { GROQ_API_KEY } from './env.js';


const groq = new Groq({ apiKey: GROQ_API_KEY });

export async function analyzeJobDescription(description) {
  if (!description) return { germanRequired: "Unknown", summary: "" };

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",


      messages: [
        { role: "system", content: "You are an assistant that analyzes job postings." },
        {
          role: "user",
          content: `
            Analyze this job description and return ONLY in JSON:
            {
              "germanRequired": "Yes" or "No",
              "summary": "short summary in English"
            }
            ---
            ${description}
          `,
        },
      ],
      temperature: 0.2,
      max_tokens: 300,
    });



    let rawText= completion.choices[0]?.message?.content?.trim();

    // Remove accidental text like "Here is the JSON:"
    const jsonMatch= rawText.match(/\{[\s\S]*\}/);
    if(!jsonMatch){
        throw new Error("No JSON object  found in the Groq Response")
    }



    rawText = jsonMatch[0]; 
    return JSON.parse(rawText);

  } catch (err) {
    console.error(`Groq analysis failed: ${err}`);
    return { germanRequired: "Error", summary: "" };
  }
}
