// src/utils.js
import he from 'he';

export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
  
    // --- Core Management Titles (English & German) ---
    "project manager",
    "program manager",
    "product manager",
    "product owner",
    "manager",
    "projektmanager",
    "projektleiter", // German for Project Lead/Manager
    "programmmanager",
    "produktmanager",

    // --- Leadership Titles (English & German) ---
    "lead",
    "team lead",
    "tech lead",
    "engineering manager",
    "leiter",         // German for Leader / Head / Manager
    "leitung",        // German for Leadership / Management
    "teamleiter",     // German for Team Lead
    "gruppenleiter",  // German for Group Lead
    "technischer leiter", // German for Technical Lead / Engineering Manager

    // --- Executive & Seniority Titles (English & German) ---
    "head of",
    "director",
    "chief",
    "vp",
    "vice president",
    "principal",
    "senior",
    "abteilungsleiter", // German for Head of Department
    "bereichsleiter",   // German for Head of Division / Area
    "direktor",
    "geschäftsführer",  // German for Managing Director / CEO
    "vorstand"          // German for Executive Board Member

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
