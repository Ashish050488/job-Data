import { Router } from 'express';
import { ObjectId } from 'mongodb';
import {
    getJobsPaginated,
    addCuratedJob,
    deleteJobById,
    getPublicBaitJobs,
    castJobVote,
    getRejectedJobs,
    getCompanyDirectoryStats,
    getJobsForReview,
    reviewJobDecision,
    findJobById,
    findJobByIdOrJobID,
    getJobsEligibleForReanalysis,
    countManuallyReviewedJobs,
    updateJobAfterReanalysis,
    restoreRejectedJobToQueue,
    cleanAllDescriptions,
    deleteJobsByCompany,
    connectToDb
} from '../Db/databaseManager.js';

import { analyzeJobWithGroq } from '../grokAnalyzer.js';
// ✅ FIXED: Import the correct middleware names
import { verifyToken, verifyAdmin } from '../middleware/authMiddleware.js';

export const jobsApiRouter = Router();

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function isManuallyReviewed(job) {
    const reviewed = job?.reviewedAt !== undefined && job?.reviewedAt !== null;
    if (!reviewed) return false;
    return job?.Status === 'active' || job?.Status === 'rejected';
}

// ---------------------------------------------------------
// PUBLIC ROUTES
// ---------------------------------------------------------

jobsApiRouter.get('/public-bait', async (req, res) => {
    try {
        const jobs = await getPublicBaitJobs();
        res.status(200).json(jobs);
    } catch (error) {
        res.status(500).json({ error: "Failed to load bait jobs" });
    }
});

jobsApiRouter.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const company = req.query.company || null;
        const data = await getJobsPaginated(page, limit, company);
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch jobs" });
    }
});

jobsApiRouter.get('/directory', async (req, res) => {
    try {
        const directory = await getCompanyDirectoryStats();
        res.status(200).json(directory);
    } catch (error) {
        res.status(500).json({ error: "Failed to load directory" });
    }
});

// ---------------------------------------------------------
// ADMIN ROUTES
// ---------------------------------------------------------

jobsApiRouter.get('/admin/review', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const data = await getJobsForReview(page, limit);
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ error: "Failed to load review queue" });
    }
});

jobsApiRouter.patch('/admin/decision/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { decision } = req.body;
        if (!['accept', 'reject'].includes(decision)) return res.status(400).json({ error: "Invalid decision" });
        await reviewJobDecision(id, decision);
        res.status(200).json({ message: `Job ${decision}ed successfully` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

jobsApiRouter.get('/rejected', async (req, res) => {
    try {
        const jobs = await getRejectedJobs();
        res.status(200).json(jobs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

jobsApiRouter.patch('/:id/feedback', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, visitorId } = req.body;

        const result = await castJobVote(id, status, visitorId);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

jobsApiRouter.post('/admin/reanalyze-all', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const jobs = await getJobsEligibleForReanalysis();
        const skippedManualReview = await countManuallyReviewedJobs();

        const summary = {
            total: jobs.length,
            reanalyzed: 0,
            changedToRejected: 0,
            changedToPending: 0,
            skippedManualReview
        };

        for (let index = 0; index < jobs.length; index += 1) {
            const job = jobs[index];

            try {
                const oldGermanRequired = Boolean(job.GermanRequired);
                const aiResult = await analyzeJobWithGroq(job.JobTitle, job.Description);

                if (!aiResult) {
                    continue;
                }

                let nextStatus = job.Status || 'pending_review';
                let rejectionReason = job.RejectionReason || null;

                if (!oldGermanRequired && aiResult.german_required === true) {
                    nextStatus = 'rejected';
                    rejectionReason = 'German language required';
                    summary.changedToRejected += 1;
                } else if (oldGermanRequired && aiResult.german_required === false) {
                    nextStatus = 'pending_review';
                    rejectionReason = null;
                    summary.changedToPending += 1;
                }

                await updateJobAfterReanalysis(job._id, aiResult, nextStatus, rejectionReason);
                summary.reanalyzed += 1;
            } catch (error) {
                console.error(`[Reanalyze All] Failed for job ${job?._id}:`, error.message);
            }

            if (index < jobs.length - 1) {
                await delay(10000);
            }
        }

        res.status(200).json(summary);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

jobsApiRouter.post('/admin/reanalyze/:id', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const job = await findJobByIdOrJobID(id);

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        if (isManuallyReviewed(job)) {
            return res.status(200).json({
                skipped: true,
                reason: 'Job was manually reviewed by admin and cannot be re-analyzed',
                job
            });
        }

        const oldGermanRequired = Boolean(job.GermanRequired);
        const aiResult = await analyzeJobWithGroq(job.JobTitle, job.Description);

        if (!aiResult) {
            return res.status(500).json({ error: 'AI analysis failed' });
        }

        let nextStatus = job.Status || 'pending_review';
        let rejectionReason = job.RejectionReason || null;

        if (!oldGermanRequired && aiResult.german_required === true) {
            nextStatus = 'rejected';
            rejectionReason = 'German language required';
        } else if (oldGermanRequired && aiResult.german_required === false) {
            nextStatus = 'pending_review';
            rejectionReason = null;
        }

        const updatedJob = await updateJobAfterReanalysis(job._id, aiResult, nextStatus, rejectionReason);

        res.status(200).json({
            skipped: false,
            job: updatedJob
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

jobsApiRouter.post('/:id/analyze', async (req, res) => {
    try {
        const { id } = req.params;
        const job = await findJobById(id);
        if (!job) return res.status(404).json({ error: "Job not found" });

        const aiResult = await analyzeJobWithGroq(job.JobTitle, job.Description, job.Location);
        if (!aiResult) return res.status(500).json({ error: "AI Analysis failed" });

        let newStatus = "pending_review";
        let rejectionReason = null;

        if (aiResult.location_classification !== "Germany") {
            newStatus = "rejected";
            rejectionReason = "Location not Germany";
        } else if (aiResult.english_speaking !== true) {
            newStatus = "rejected";
            rejectionReason = "Not English-speaking";
        } else if (aiResult.german_required === true) {
            newStatus = "rejected";
            rejectionReason = "German Language Required";
        }

        const db = await connectToDb();
        
        await db.collection('jobs').updateOne(
            { _id: new ObjectId(id) },
            { 
                $set: { 
                    EnglishSpeaking: aiResult.english_speaking,
                    GermanRequired: aiResult.german_required,
                    Domain: aiResult.domain,
                    SubDomain: aiResult.sub_domain,
                    ConfidenceScore: aiResult.confidence,
                    Status: newStatus,
                    RejectionReason: rejectionReason,
                    updatedAt: new Date()
                } 
            }
        );

        res.status(200).json({ 
            message: "Job re-analyzed", 
            newStatus, 
            english: aiResult.english_speaking,
            german: aiResult.german_required
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

jobsApiRouter.delete('/company', async (req, res) => {
    try {
        const { name } = req.query;
        if (name) {
            const result = await deleteJobsByCompany(name);
            return res.status(200).json({ message: `Deleted ${result.deletedCount} jobs for ${name}.` });
        }
        res.status(400).json({ error: "Name required" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

jobsApiRouter.post('/', async (req, res) => {
    try {
        const jobData = req.body;
        const newJob = await addCuratedJob(jobData); 
        res.status(201).json(newJob);
    } catch (error) {
        if (error.message.includes('duplicate URL')) return res.status(409).json({ error: error.message });
        res.status(500).json({ error: error.message });
    }
});

jobsApiRouter.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid ID' });
        await deleteJobById(new ObjectId(id));
        res.status(200).json({ message: 'Job deleted.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ TEST LOGS ROUTE - With correct auth middleware and collection name
jobsApiRouter.get('/test-logs', verifyToken, verifyAdmin, async (req, res) => {
    console.log('[API] test-logs route hit');
    try {
        const db = await connectToDb();
        console.log('[API] DB connected');
        
        // ✅ FIXED: Lowercase 'j' to match your databaseManager.js
        const logs = await db.collection('jobTestLogs')
            .find({})
            .sort({ scrapedAt: -1 })
            .limit(500)
            .toArray();
        
        console.log('[API] Found logs:', logs.length);
        res.status(200).json(logs);
    } catch (error) {
        console.error('[API] Error fetching test logs:', error);
        res.status(500).json({ error: 'Failed to fetch test logs', details: error.message });
    }
});

jobsApiRouter.patch('/admin/restore/:id', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid ID' });
        }

        await restoreRejectedJobToQueue(id);
        res.status(200).json({ message: 'Job restored to pending review queue' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

jobsApiRouter.post('/admin/clean-descriptions', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const summary = await cleanAllDescriptions();
        res.status(200).json(summary);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});