import { createJobModel } from '../models/jobModel.js';
import { MongoClient, ObjectId } from 'mongodb';
import mongoose from 'mongoose';
import { MONGO_URI } from '../env.js';
import { SITES_CONFIG } from '../config.js';
import { createUserModel } from '../models/userModel.js';
import bcrypt from 'bcryptjs';
import { StripHtml } from '../utils.js';

export const client = new MongoClient(MONGO_URI);
let db;

export async function connectToDb() {
    if (db) return db;
    
    await client.connect();
    
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(MONGO_URI);
        console.log("🍃 Mongoose Connected");
    }

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

export async function saveJobTestLog(jobTestLog) {
    if (!jobTestLog) return;
    const db = await connectToDb();
    const testLogsCollection = db.collection('jobTestLogs');

    const { createdAt, ...pureJobData } = jobTestLog;
    
    await testLogsCollection.updateOne(
        { JobID: jobTestLog.JobID, sourceSite: jobTestLog.sourceSite },
        {
            $set: {
                ...pureJobData,
                scrapedAt: new Date()
            },
            $setOnInsert: { createdAt: new Date() }
        },
        { upsert: true }
    );
}

export async function deleteOldJobs(siteName, scrapeStartTime) {
    const db = await connectToDb();
    const jobsCollection = db.collection('jobs');
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const result = await jobsCollection.deleteMany({
        sourceSite: siteName,
        updatedAt: { $lt: sevenDaysAgo }
    });
    
    if (result.deletedCount > 0) {
        console.log(`[${siteName}] Deleted ${result.deletedCount} jobs older than 7 days.`);
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
   return await usersCollection.find({ 
        isSubscribed: true,
        isWaitlist: { $ne: true }
    }).toArray();
}

export async function findMatchingJobs(user) {
    const db = await connectToDb();
    const jobsCollection = db.collection('jobs');
    
    const query = {
        Status: 'active',
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
        GermanRequired: jobData.GermanRequired ?? false,
        Description: jobData.Description || `Manually curated: ${jobData.JobTitle}`,
        PostedDate: jobData.PostedDate || new Date().toISOString(),
        ContractType: jobData.ContractType,
        ExperienceLevel: jobData.ExperienceLevel,
        isManual: true,
        Status: 'active'
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
        Status: 'active',
        GermanRequired: false
    })
        .sort({ PostedDate: -1, createdAt: -1 })
        .limit(9)
        .project({
            JobTitle: 1, Company: 1, Location: 1, Department: 1,
            PostedDate: 1, ApplicationURL: 1, GermanRequired: 1, thumbsUp: 1, thumbsDown: 1
        })
        .toArray();
    return jobs.map(job => ({ ...job, thumbsUp: job.thumbsUp || 0, thumbsDown: job.thumbsDown || 0 }));
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

export async function getJobsPaginated(page = 1, limit = 50, companyFilter = null) {
    const db = await connectToDb();
    const jobsCollection = db.collection('jobs');
    const skip = (page - 1) * limit;

    const query = {
        Status: 'active',
        GermanRequired: false
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

    const companies = await jobsCollection.distinct('Company', { Status: 'active' });

    const normalizedJobs = jobs.map(job => ({
        ...job,
        thumbsUp: job.thumbsUp || 0,
        thumbsDown: job.thumbsDown || 0
    }));

    return { jobs: normalizedJobs, totalJobs, companies };
}

export async function getRejectedJobs() {
    const db = await connectToDb();
    const jobsCollection = db.collection('jobs');
    return await jobsCollection.find({ Status: 'rejected' })
        .sort({ updatedAt: -1 })
        .toArray();
}

export async function getJobsForReview(page = 1, limit = 50) {
    const db = await connectToDb();
    const jobsCollection = db.collection('jobs');
    const skip = (page - 1) * limit;

    const query = { Status: 'pending_review' };

    const totalJobs = await jobsCollection.countDocuments(query);
    const jobs = await jobsCollection.find(query)
        .sort({ ConfidenceScore: -1, scrapedAt: -1 })
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

export async function reviewJobDecision(jobId, decision) {
    const db = await connectToDb();
    const jobsCollection = db.collection('jobs');

    let newStatus = 'pending_review';
    if (decision === 'accept') newStatus = 'active';
    if (decision === 'reject') newStatus = 'rejected';

    await jobsCollection.updateOne(
        { _id: new ObjectId(jobId) },
        {
            $set: {
                Status: newStatus,
                reviewedAt: new Date()
            }
        }
    );
    return { success: true, status: newStatus };
}

export async function castJobVote(jobId, status, visitorId) {
    const db = await connectToDb();
    const jobsCollection = db.collection('jobs');
    const votesCollection = db.collection('votes');

    if (!ObjectId.isValid(jobId)) {
        throw new Error('Invalid job id');
    }
    if (!['up', 'down'].includes(status)) {
        throw new Error('Invalid vote status');
    }
    if (!visitorId || typeof visitorId !== 'string') {
        throw new Error('visitorId is required');
    }

    const objectId = new ObjectId(jobId);
    const existingVote = await votesCollection.findOne({ jobId: objectId, visitorId });

    let userVote = null;
    if (existingVote && existingVote.vote === status) {
        await votesCollection.deleteOne({ _id: existingVote._id });
    } else if (existingVote && existingVote.vote !== status) {
        await votesCollection.updateOne(
            { _id: existingVote._id },
            { $set: { vote: status, createdAt: new Date() } }
        );
        userVote = status;
    } else {
        await votesCollection.insertOne({
            jobId: objectId,
            visitorId,
            vote: status,
            createdAt: new Date()
        });
        userVote = status;
    }

    const voteCounts = await votesCollection.aggregate([
        { $match: { jobId: objectId } },
        { $group: { _id: '$vote', count: { $sum: 1 } } }
    ]).toArray();

    const thumbsUp = voteCounts.find(v => v._id === 'up')?.count || 0;
    const thumbsDown = voteCounts.find(v => v._id === 'down')?.count || 0;

    await jobsCollection.updateOne(
        { _id: objectId },
        { $set: { thumbsUp, thumbsDown, updatedAt: new Date() } }
    );

    return { thumbsUp, thumbsDown, userVote };
}

export async function getCompanyDirectoryStats() {
    try {
        const db = await connectToDb();

        const jobsCollection = db.collection('jobs');
        const pipeline = [
            { 
                $match: { 
                    Status: 'active', 
                    GermanRequired: false
                } 
            },
            {
                $group: {
                    _id: "$Company",
                    openRoles: { $sum: 1 },
                    locations: { $addToSet: "$Location" },
                    sampleUrl: { $first: "$ApplicationURL" }
                }
            },
            { $sort: { openRoles: -1 } }
        ];
        const scrapedStats = await jobsCollection.aggregate(pipeline).toArray();

        const formattedScraped = scrapedStats.map(stat => ({
            _id: stat._id, 
            companyName: stat._id || "Unknown",
            openRoles: stat.openRoles,
            cities: [...new Set((stat.locations || []).map(l => l.split(',')[0].trim()))].slice(0, 2),
            domain: stat._id.toLowerCase().replace(/[^a-z0-9-]/g, '') + ".com",
            source: 'scraped'
        }));
        return formattedScraped;

    } catch (error) {
        console.error("Stats: Aggregation failed:", error);
        return [];
    }
}

export async function findJobById(id) {
    const db = await connectToDb();
    return await db.collection('jobs').findOne({ _id: new ObjectId(id) });
}

export async function findJobByIdOrJobID(idOrJobID) {
    const db = await connectToDb();
    const jobsCollection = db.collection('jobs');

    if (ObjectId.isValid(idOrJobID)) {
        const byObjectId = await jobsCollection.findOne({ _id: new ObjectId(idOrJobID) });
        if (byObjectId) return byObjectId;
    }

    return await jobsCollection.findOne({ JobID: idOrJobID });
}

export async function getJobsEligibleForReanalysis() {
    const db = await connectToDb();
    const jobsCollection = db.collection('jobs');

    return await jobsCollection.find({
        $or: [
            { Status: 'pending_review' },
            {
                Status: 'rejected',
                $or: [
                    { reviewedAt: { $exists: false } },
                    { reviewedAt: null }
                ]
            }
        ]
    }).toArray();
}

export async function countManuallyReviewedJobs() {
    const db = await connectToDb();
    const jobsCollection = db.collection('jobs');

    return await jobsCollection.countDocuments({
        $or: [
            { Status: 'active', reviewedAt: { $exists: true, $ne: null } },
            { Status: 'rejected', reviewedAt: { $exists: true, $ne: null } }
        ]
    });
}

export async function updateJobAfterReanalysis(jobId, aiResult, status, rejectionReason) {
    const db = await connectToDb();
    const jobsCollection = db.collection('jobs');

    await jobsCollection.updateOne(
        { _id: new ObjectId(jobId) },
        {
            $set: {
                GermanRequired: aiResult.german_required,
                Domain: aiResult.domain,
                SubDomain: aiResult.sub_domain,
                ConfidenceScore: aiResult.confidence,
                Evidence: aiResult.evidence || { german_reason: '' },
                Status: status,
                RejectionReason: rejectionReason,
                updatedAt: new Date()
            }
        }
    );

    return await jobsCollection.findOne({ _id: new ObjectId(jobId) });
}

export async function restoreRejectedJobToQueue(jobId) {
    const db = await connectToDb();
    const jobsCollection = db.collection('jobs');

    await jobsCollection.updateOne(
        { _id: new ObjectId(jobId) },
        {
            $set: {
                Status: 'pending_review',
                RejectionReason: null,
                updatedAt: new Date()
            },
            $unset: {
                reviewedAt: ''
            }
        }
    );
}

export async function deleteJobsByCompany(companyName) {
    const db = await connectToDb();
    console.log(`[Admin] Deleting all jobs for company: ${companyName}`);
    return await db.collection('jobs').deleteMany({
        Company: { $regex: new RegExp(`^${companyName}$`, 'i') }
    });
}

export async function registerUser({ email, password, name, role = 'user', location, domain, isWaitlist }) {
    const db = await connectToDb();
    const usersCollection = db.collection('users');

    const existingUser = await usersCollection.findOne({ email });
    if (existingUser) {
        throw new Error("User already exists");
    }

    let hashedPassword = null;
    if (password) {
        const salt = await bcrypt.genSalt(10);
        hashedPassword = await bcrypt.hash(password, salt);
    }

    const newUser = createUserModel({
        email,
        password: hashedPassword,
        name,
        role,
        location,
        domain,
        isWaitlist,
        createdAt: new Date()
    });

    await usersCollection.insertOne(newUser);
    
    return { 
        id: newUser._id, 
        email: newUser.email, 
        role: newUser.role, 
        name: newUser.name 
    };
}

export async function loginUser(email, password) {
    const db = await connectToDb();
    const usersCollection = db.collection('users');

    const user = await usersCollection.findOne({ email });
    if (!user) {
        throw new Error("Invalid credentials");
    }

    if (!user.password) {
        throw new Error("Please register an account first.");
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        throw new Error("Invalid credentials");
    }

    return { id: user._id, email: user.email, role: user.role, name: user.name };
}

export async function getUserProfile(userId) {
    const db = await connectToDb();
    const usersCollection = db.collection('users');
    return await usersCollection.findOne({ _id: new ObjectId(userId) }, { projection: { password: 0 } });
}

export async function cleanAllDescriptions() {
    const db = await connectToDb();
    const jobsCollection = db.collection('jobs');
    const logsCollection = db.collection('jobTestLogs');

    let total = 0;
    let cleaned = 0;

    const cleanInCollection = async (collection) => {
        const cursor = collection.find({}, { projection: { _id: 1, Description: 1 } });

        while (await cursor.hasNext()) {
            const document = await cursor.next();
            total += 1;

            const currentDescription = typeof document?.Description === 'string' ? document.Description : '';
            const nextDescription = StripHtml(currentDescription);

            if (nextDescription !== currentDescription) {
                await collection.updateOne(
                    { _id: document._id },
                    { $set: { Description: nextDescription, updatedAt: new Date() } }
                );
                cleaned += 1;
            }
        }
    };

    await cleanInCollection(jobsCollection);
    await cleanInCollection(logsCollection);

    return {
        total,
        cleaned,
        alreadyClean: total - cleaned
    };
}