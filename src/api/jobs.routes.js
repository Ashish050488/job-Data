import { Router } from 'express';
import { 
    getJobsPaginated, 
    addCuratedJob, 
    deleteJobById 
} from '../Db/databaseManager.js'; // Note the '../' to go up one level
import { ObjectId } from 'mongodb';

export const jobsApiRouter = Router();

/**
 * GET /api/jobs
 * Fetches all jobs from the database with pagination.
 */
jobsApiRouter.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;

        const { jobs, totalJobs } = await getJobsPaginated(page, limit);
            
        res.status(200).json({
            jobs,
            totalJobs,
            totalPages: Math.ceil(totalJobs / limit),
            currentPage: page
        });
    } catch (error) {
        console.error('[API] Error fetching jobs:', error.message);
        res.status(500).json({ error: "Failed to fetch jobs" });
    }
});

/**
 * POST /api/jobs
 * Manually adds a new "Curated" job. This replaces entry-server.js.
 */
jobsApiRouter.post('/', async (req, res) => {
    try {
        const jobData = req.body;
        // This function now contains the duplicate check logic
        const newJob = await addCuratedJob(jobData); 
        res.status(201).json(newJob);
    } catch (error) {
        console.error('[API] Error saving job:', error.message);
        // Handle duplicate URL error specifically
        if (error.message.includes('duplicate URL')) {
            return res.status(409).json({ error: error.message });
        }
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/jobs/:id
 * Deletes a job by its MongoDB _id.
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

