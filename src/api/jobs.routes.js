import { Router } from 'express';
import { ObjectId } from 'mongodb';
import {
    getJobsPaginated,
    addCuratedJob,
    deleteJobById,
    getPublicBaitJobs,
    updateJobFeedback,
    getRejectedJobs,
    getCompanyDirectoryStats,
    getJobsForReview,
    reviewJobDecision,
    findJobById,
    deleteJobsByCompany,
    addManualCompany,
    deleteManualCompany
} from '../Db/databaseManager.js';

// ✅ CRITICAL FIX: Ensure this path is correct. 
// Move your grokAnalyzer.js file to 'src/core/grokAnalyzer.js' if it fails.
import { analyzeJobWithGroq } from '../grokAnalyzer.js';

export const jobsApiRouter = Router();

// ---------------------------------------------------------
// PUBLIC ROUTES
// ---------------------------------------------------------

// 1. Public Bait
jobsApiRouter.get('/public-bait', async (req, res) => {
    try {
        const jobs = await getPublicBaitJobs();
        res.status(200).json(jobs);
    } catch (error) {
        res.status(500).json({ error: "Failed to load bait jobs" });
    }
});

// 2. Main Feed
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

// 3. Directory
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

// 4. Review Queue
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

// 5. Make Decision (Accept/Reject)
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

// 6. Rejected Jobs List
jobsApiRouter.get('/rejected', async (req, res) => {
    try {
        const jobs = await getRejectedJobs();
        res.status(200).json(jobs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 7. Update Job Feedback
jobsApiRouter.patch('/:id/feedback', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        await updateJobFeedback(id, status);
        res.status(200).json({ message: 'Feedback updated' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 8. Re-Analyze Job (AI)
jobsApiRouter.post('/:id/analyze', async (req, res) => {
    try {
        const { id } = req.params;
        const job = await findJobById(id);
        if (!job) return res.status(404).json({ error: "Job not found" });

        const aiResult = await analyzeJobWithGroq(job.JobTitle, job.Description, job.Location);
        if (!aiResult) return res.status(500).json({ error: "AI Analysis failed" });

        // ✅ UPDATED LOGIC: Apply the same strict filtering as in processor.js
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

        const { connectToDb } = await import('../Db/databaseManager.js');
        const db = await connectToDb();
        
        await db.collection('jobs').updateOne(
            { _id: new ObjectId(id) },
            { 
                $set: { 
                    EnglishSpeaking: aiResult.english_speaking, // ✅ NEW FIELD
                    GermanRequired: aiResult.german_required,
                    LocationClassification: aiResult.location_classification, // ✅ NEW FIELD
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
            german: aiResult.german_required,
            location: aiResult.location_classification 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 9. Add Manual Company
jobsApiRouter.post('/companies', async (req, res) => {
    try {
        const { name, domain, cities } = req.body;
        if (!name) return res.status(400).json({ error: "Company Name is required" });
        await addManualCompany({ name, domain, cities });
        res.status(201).json({ message: "Company added." });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 10. Delete Company (Handles both Scraped and Manual)
jobsApiRouter.delete('/company', async (req, res) => {
    try {
        const { name } = req.query; // ?name=Zalando
        if (name) {
            const result = await deleteJobsByCompany(name);
            return res.status(200).json({ message: `Deleted ${result.deletedCount} jobs for ${name}.` });
        }
        res.status(400).json({ error: "Name required" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

jobsApiRouter.delete('/companies/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await deleteManualCompany(id);
        res.status(200).json({ message: "Manual company deleted." });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 11. Add Manual Job
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

// 12. Delete Job ID
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