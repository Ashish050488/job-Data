import he from 'he';

export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export function StripHtml(html) {
        if (!html) return "";
    const stripped = he.decode(html).replace(/<[^>]+>/g, "");
    const clean = he.decode(stripped).replace(/\s+/g, " ").trim();
    return clean;

}

// Banned Roles (Noise Filter) - Keep this strict
export const BANNED_ROLES = [
    "intern", "internship", "werkstudent", "werkstudentin", 
    "working student", "student assistant", "studentische hilfskraft",
    "ausbildung", "trainee", "duales studium", "apprentice", "apprenticeship",
    "filialleiter", "filialleitung", "store manager", "shop manager", 
    "verkäufer", "sales assistant", "cashier",
    "zeitarbeit", "leiharbeit", "phd thesis", "master thesis", "bachelor thesis"
];