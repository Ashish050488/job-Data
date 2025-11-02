// databaseManager.js
import {createJobModel} from '../models/jobModel.js';
import { MongoClient } from 'mongodb';
import { MONGO_URI } from '../env.js';
import { SITES_CONFIG } from '../config.js';

export const client = new MongoClient(MONGO_URI);
let db;

export async function connectToDb() {
    if (db) return db;
    await client.connect();
    db = client.db("job-scraper");
    console.log("🗄️  Successfully connected to MongoDB.");
    return db;
}

export async function loadAllExistingIDs() {
    const db = await connectToDb();
    const jobsCollection = db.collection('jobs');
    const existingIDsMap = new Map();
    for (const siteConfig of SITES_CONFIG) {
        const siteName = siteConfig.siteName;
        const idSet = new Set();
        const jobs = await jobsCollection.find({ sourceSite: siteName }, { projection: { JobID: 1 } }).toArray();
        jobs.forEach(job => idSet.add(job.JobID));
        existingIDsMap.set(siteName, idSet);
        console.log(`[${siteName}] Found ${idSet.size} existing jobs in the database.`);
    }
    return existingIDsMap;
}

export async function saveJobs(jobs) {
    if (jobs.length === 0) return;
    const db = await connectToDb();
    const jobsCollection = db.collection('jobs');

    const operations = jobs.map(job => {
        // Separate the fields that should only be set on insert
        const { createdAt, ...updateData } = job;

        return {
            updateOne: {
                filter: { JobID: job.JobID, sourceSite: job.sourceSite },
                update: {
                    $set: updateData, // Update all fields
                    $setOnInsert: { createdAt: createdAt } // Only set createdAt when a new document is inserted
                },
                upsert: true,
            },
        };
    });

    await jobsCollection.bulkWrite(operations);
}

export async function deleteOldJobs(siteName, scrapeStartTime) {
    const db = await connectToDb();
    const jobsCollection = db.collection('jobs');
    const result = await jobsCollection.deleteMany({
        sourceSite: siteName,
        updatedAt: { $lt: scrapeStartTime } // Use updatedAt for the check
    });
    if (result.deletedCount > 0) {
        console.log(`[${siteName}] Deleted ${result.deletedCount} expired jobs.`);
    }
}


export async function deleteJobById(jobId) { // 'jobId' is already an ObjectId
    try {
        const db = await connectToDb();
        const jobsCollection = db.collection('jobs');

        // JUST use 'jobId' directly
        await jobsCollection.deleteOne({ _id: jobId });

    } catch (error) {
        console.error(`Error deleting job ${jobId}:`, error);
    }
}

// In databaseManager.js - ADD THESE FUNCTIONS AT THE END

// Fetches all users who are subscribed to receive emails
export async function getSubscribedUsers() {
    const db = await connectToDb();
    const usersCollection = db.collection('users');
    return await usersCollection.find({ isSubscribed: true }).toArray();
}

// Finds jobs that match a user's specific criteria
export async function findMatchingJobs(user) {
    const db = await connectToDb();
    const jobsCollection = db.collection('jobs');

    // Build a query based on the user's preferences
    const query = {
        // Only jobs not requiring German
        GermanRequired: false,
        // The job's department must be one of the user's desired domains
        Department: { $in: user.desiredDomains },
        // The job's ID must not be in the user's "already sent" list
        JobID: { $nin: user.sentJobIds },
    };

    // This is a simple text search for the user's desired roles in the job title
    if (user.desiredRoles && user.desiredRoles.length > 0) {
        query.$text = { $search: user.desiredRoles.join(' ') };
    }

    // Find the newest 5 jobs that match
    return await jobsCollection.find(query).sort({ scrapedAt: -1 }).limit(5).toArray();
}


// Updates a user's record after an email has been sent
export async function updateUserAfterEmail(userId, newSentJobIds) {
    const db = await connectToDb();
    const usersCollection = db.collection('users');

    await usersCollection.updateOne(
        { _id: userId },
        {
            $set: { lastEmailSent: new Date() },
            $push: { sentJobIds: { $each: newSentJobIds } }
        }
    );
}

export async function getJobsPaginated(page = 1, limit = 50) {
    const db = await connectToDb();
    const jobsCollection = db.collection('jobs');
    const skip = (page - 1) * limit;

    const totalJobs = await jobsCollection.countDocuments();
    const jobs = await jobsCollection.find({})
        .sort({ PostedDate: -1, createdAt: -1 }) // Sort by date
        .skip(skip)
        .limit(limit)
        .toArray();

    return { jobs, totalJobs };
}


export async function addCuratedJob(jobData) {
    if (!jobData.JobTitle || !jobData.ApplicationURL || !jobData.Company) {
        throw new Error('Job Title, URL, and Company are required.');
    }

    const db = await connectToDb();
    const jobsCollection = db.collection('jobs');

    // Check for duplicate URL
    const existingJob = await jobsCollection.findOne({ ApplicationURL: jobData.ApplicationURL });
    if (existingJob) {
        throw new Error('This Application URL already exists in the database.');
    }

    const jobID = `curated-${new Date().getTime()}`;

    const jobToSave = createJobModel({ // <-- This line was causing the error
        JobID: jobID,
        JobTitle: jobData.JobTitle,
        ApplicationURL: jobData.ApplicationURL,
        Company: jobData.Company, // Your manual company name
        Location: jobData.Location,
        Department: jobData.Department,
        GermanRequired: jobData.GermanRequired,
        Description: jobData.Description || `Manually curated: ${jobData.JobTitle}`,
        PostedDate: jobData.PostedDate || new Date().toISOString(),
        ContractType: jobData.ContractType,
        ExperienceLevel: jobData.ExperienceLevel,
        isManual: true // Set this to true for curated jobs
    }, "Curated");

    await saveJobs([jobToSave]);
    return jobToSave; // Return the created job
}


export async function getAllJobs(page = 1, limit = 50) {
    const db = await connectToDb();
    const jobsCollection = db.collection('jobs');
    const skip = (page - 1) * limit;

    const totalJobs = await jobsCollection.countDocuments();
    const jobs = await jobsCollection.find({})
        .sort({ PostedDate: -1, createdAt: -1 }) // Show newest first
        .skip(skip)
        .limit(limit)
        .toArray();

    return {
        jobs,
        totalJobs,
        totalPages: Math.ceil(totalJobs / limit),
        currentPage: page
    };
}


