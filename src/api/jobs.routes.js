import { Router } from 'express';
import { 
    getJobsPaginated, 
    addCuratedJob, 
    deleteJobById, 
    getPublicBaitJobs,
    updateJobFeedback, // Import this
    getRejectedJobs ,   // Import this
    getCompanyDirectoryStats,
    getJobsForReview,  // Import this
    reviewJobDecision
} from '../Db/databaseManager.js'; 
import { ObjectId } from 'mongodb';

export const jobsApiRouter = Router();

// ✅ FIX 1: This MUST be the first route defined
jobsApiRouter.get('/public-bait', async (req, res) => {
    try {
        const jobs = await getPublicBaitJobs();
        res.status(200).json(jobs);
    } catch (error) {
        res.status(500).json({ error: "Failed to load bait jobs" });
    }
});

// ✅ GET /api/jobs/rejected (Protected route for dismissed jobs)
jobsApiRouter.get('/rejected', async (req, res) => {
    try {
        const jobs = await getRejectedJobs();
        res.status(200).json(jobs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/jobs
 * Fetches all jobs from the database with pagination and optional company filter.
 */
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



jobsApiRouter.patch('/admin/decision/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { decision } = req.body; // 'accept' or 'reject'

        if (!['accept', 'reject'].includes(decision)) {
            return res.status(400).json({ error: "Invalid decision" });
        }

        await reviewJobDecision(id, decision);
        res.status(200).json({ message: `Job ${decision}ed successfully` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



jobsApiRouter.get('/admin/review', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const data = await getJobsForReview(page, limit);
        res.status(200).json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to load review queue" });
    }
});


jobsApiRouter.patch('/:id/feedback', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // 'up' or 'down' or null
        await updateJobFeedback(id, status);
        res.status(200).json({ message: 'Feedback updated' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/jobs
 * Manually adds a new "Curated" job.
 */
jobsApiRouter.post('/', async (req, res) => {
    try {
        const jobData = req.body;
        const newJob = await addCuratedJob(jobData); 
        res.status(201).json(newJob);
    } catch (error) {
        console.error('[API] Error saving job:', error.message);
        if (error.message.includes('duplicate URL')) {
            return res.status(409).json({ error: error.message });
        }
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/jobs/:id
 */
jobsApiRouter.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid Job ID format.' });
        }
        await deleteJobById(new ObjectId(id));
        res.status(200).json({ message: 'Job deleted successfully.' });
    } catch (error) {
        console.error(`[API] Error deleting job:`, error.message);
        res.status(500).json({ error: error.message });
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