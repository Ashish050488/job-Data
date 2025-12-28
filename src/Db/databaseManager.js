import { createJobModel } from '../models/jobModel.js';
import { MongoClient } from 'mongodb';
import { MONGO_URI } from '../env.js';
import { SITES_CONFIG } from '../config.js';
import { createUserModel } from '../models/userModel.js';

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
        const { createdAt, updatedAt, ...pureJobData } = job;
        return {
            updateOne: {
                filter: { JobID: job.JobID, sourceSite: job.sourceSite },
                update: {
                    $set: { 
                        ...pureJobData, 
                        updatedAt: new Date(),
                        scrapedAt: new Date() 
                    }, 
                    $setOnInsert: { createdAt: new Date() } 
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
        updatedAt: { $lt: scrapeStartTime }
    });
    if (result.deletedCount > 0) {
        console.log(`[${siteName}] Deleted ${result.deletedCount} expired jobs.`);
    }
}

export async function deleteJobById(jobId) {
    try {
        const db = await connectToDb();
        const jobsCollection = db.collection('jobs');
        await jobsCollection.deleteOne({ _id: jobId });
    } catch (error) {
        console.error(`Error deleting job ${jobId}:`, error);
    }
}

export async function getSubscribedUsers() {
    const db = await connectToDb();
    const usersCollection = db.collection('users');
    return await usersCollection.find({ isSubscribed: true }).toArray();
}

export async function findMatchingJobs(user) {
    const db = await connectToDb();
    const jobsCollection = db.collection('jobs');
    const query = {
        GermanRequired: false,
        Department: { $in: user.desiredDomains },
        JobID: { $nin: user.sentJobIds },
    };
    if (user.desiredRoles && user.desiredRoles.length > 0) {
        query.$text = { $search: user.desiredRoles.join(' ') };
    }
    return await jobsCollection.find(query).sort({ scrapedAt: -1 }).limit(3).toArray();
}

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

export async function addCuratedJob(jobData) {
    if (!jobData.JobTitle || !jobData.ApplicationURL || !jobData.Company) {
        throw new Error('Job Title, URL, and Company are required.');
    }
    const db = await connectToDb();
    const jobsCollection = db.collection('jobs');
    const existingJob = await jobsCollection.findOne({ ApplicationURL: jobData.ApplicationURL });
    if (existingJob) {
        throw new Error('This Application URL already exists in the database.');
    }
    const jobID = `curated-${new Date().getTime()}`;
    const jobToSave = createJobModel({
        JobID: jobID,
        JobTitle: jobData.JobTitle,
        ApplicationURL: jobData.ApplicationURL,
        Company: jobData.Company,
        Location: jobData.Location,
        Department: jobData.Department,
        GermanRequired: jobData.GermanRequired,
        Description: jobData.Description || `Manually curated: ${jobData.JobTitle}`,
        PostedDate: jobData.PostedDate || new Date().toISOString(),
        ContractType: jobData.ContractType,
        ExperienceLevel: jobData.ExperienceLevel,
        isManual: true
    }, "Curated");

    await saveJobs([jobToSave]);
    return jobToSave;
}

export async function getAllJobs(page = 1, limit = 50) {
    const db = await connectToDb();
    const jobsCollection = db.collection('jobs');
    const skip = (page - 1) * limit;
    const totalJobs = await jobsCollection.countDocuments();
    const jobs = await jobsCollection.find({})
        .sort({ PostedDate: -1, createdAt: -1 })
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

export async function getPublicBaitJobs() {
    const db = await connectToDb();
    const jobsCollection = db.collection('jobs');
    const jobs = await jobsCollection.find({ 
        GermanRequired: false 
    })
    .sort({ PostedDate: -1, createdAt: -1 })
    .limit(9)
    .project({ 
        JobTitle: 1, Company: 1, Location: 1, Department: 1, 
        PostedDate: 1, ApplicationURL: 1, GermanRequired: 1 
    })
    .toArray();
    return jobs;
}

export async function addSubscriber(data) {
    const db = await connectToDb();
    const usersCollection = db.collection('users');
    const newUser = createUserModel({
        email: data.email,
        desiredDomains: data.categories, 
        emailFrequency: data.frequency,
        name: data.email.split('@')[0], 
        createdAt: new Date()
    });
    await usersCollection.updateOne(
        { email: newUser.email },
        { 
            $set: { 
                desiredDomains: newUser.desiredDomains,
                emailFrequency: newUser.emailFrequency,
                isSubscribed: true,
                updatedAt: new Date()
            },
            $setOnInsert: {
                createdAt: new Date(),
                subscriptionTier: "free",
                sentJobIds: []
            }
        },
        { upsert: true }
    );
    return { success: true, email: newUser.email };
}

// --- NEW / UPDATED FUNCTIONS ---

// 1. Updated Pagination with Filters and Company List
export async function getJobsPaginated(page = 1, limit = 50, companyFilter = null) {
    const db = await connectToDb();
    const jobsCollection = db.collection('jobs');
    const skip = (page - 1) * limit;

    // Filter: Hide "down" voted jobs. The $ne operator includes docs where thumbStatus is missing.
    const query = { 
        thumbStatus: { $ne: 'down' } 
    };

    if (companyFilter) {
        query.Company = { $regex: companyFilter, $options: 'i' }; 
    }

    const totalJobs = await jobsCollection.countDocuments(query);
    const jobs = await jobsCollection.find(query)
        .sort({ PostedDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();
    
    // Get unique companies (only for valid jobs)
    const companies = await jobsCollection.distinct("Company", { thumbStatus: { $ne: 'down' } });

    return { jobs, totalJobs, companies };
}

// 2. Get Rejected Jobs
export async function getRejectedJobs() {
    const db = await connectToDb();
    const jobsCollection = db.collection('jobs');
    return await jobsCollection.find({ thumbStatus: 'down' })
        .sort({ updatedAt: -1 })
        .toArray();
}

// 3. Update Job Feedback
export async function updateJobFeedback(jobId, status) {
    const db = await connectToDb();
    const jobsCollection = db.collection('jobs');
    const { ObjectId } = await import('mongodb'); 

    await jobsCollection.updateOne(
        { _id: new ObjectId(jobId) },
        { $set: { thumbStatus: status, updatedAt: new Date() } }
    );
}