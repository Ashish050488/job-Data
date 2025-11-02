import dotev from "dotenv";
dotev.config();
export const GROQ_API_KEY= process.env.GROQ_API_KEY;
export const MONGO_URI = process.env.MONGO_URI;

export const EMAIL_CONFIG = {
    host: 'smtp.gmail.com', // Corrected: Use Gmail's server
    port: 587,
    secure: false,
    auth: {
        user: 'ashar050488@gmail.com',
        pass: process.env.pass // Your App Password
    },
    to: 'ashishar050488@gmail.com', // Double-check this is the intended recipient
    from: '"Job Scraper Bot" <ashar050488@gmail.com>' // Corrected: Must match auth user
};