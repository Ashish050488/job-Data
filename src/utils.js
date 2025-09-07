// src/utils.js
import he from 'he';

// This is our universal HTML cleaner. It first decodes any special characters
// (like &lt;) and then removes all the HTML tags.
export function StripHtml(html) {
    if (!html) return "";
    const decodedHtml = he.decode(html);
    return decodedHtml.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

// A common set of keywords we can reuse for multiple sites.
export const COMMON_KEYWORDS =// A new, targeted filterKeywords array based on your resume
[
    // Core Management Titles
    "project manager",
    "program manager",
    "product manager",
    "product owner",

    // Leadership Titles
    "lead",
    "team lead",
    "tech lead",
    "engineering manager",

    // Seniority & Executive Titles
    "head of",
    "director",
    "chief",
    "vp",
    "vice president",
    "principal",
    "senior"
]
// [
//     // --- Roles & Titles ---
//     "software engineer intern",
//     "web developer intern",
//     "full stack intern",
//     "full-stack intern",
//     "backend intern",
//     "frontend intern",
//     "react developer intern",
//     "node.js developer intern",
//     "javascript developer intern",
//     "mern stack developer", // MERN is a great specific keyword
//     "trainee software engineer",
//     "software developer trainee",
//     "apprentice software developer",
//     "working student", // Very common term in Germany for student roles
//     "werkstudent", // The German word for "working student"

//     // --- Core Technologies (from your skills list) ---
//     "react",
//     "node.js",
//     "express.js",
//     "mongodb",
//     "javascript",
//     "python",

//     // --- General Terms for Fresher Roles ---
//     "junior",
//     "entry level",
//     "graduate"
// ]
// [
//   "finance",
//   "analyst",
//   "financial analysis",
//   "financial reporting",
//   "portfolio analysis",
//   "budgeting",
//   "forecasting",
//   "valuation",
//   "Power BI",
//   "Excel",
//   "SQL",
//   "corporate finance"
// ]
