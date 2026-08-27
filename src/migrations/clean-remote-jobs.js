// ─── Remove location-restricted jobs from remoteJobs ───────────────────────────
//
// The remote vertical is meant to be location-FREE: roles anyone can take from
// anywhere. The scraper let through a lot that only look remote —
// "Remote · United States", "Remote - US", "Remote (Hybrid)", or a bare country
// name — which are geographically restricted and belong on neither vertical.
//
// The rule is strict: Location, trimmed, must be exactly "Remote"
// (case-insensitive). With no Location at all, WorkplaceType === 'Remote' is
// the fallback signal. The predicate is IMPORTED from the cache rather than
// re-implemented here, so the migration and the runtime guard can never drift.
//
// DRY RUN BY DEFAULT — deletions require --execute.
//
//   node src/migrations/clean-remote-jobs.js            (report only)
//   node src/migrations/clean-remote-jobs.js --execute  (delete)

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const { isFullyRemote } = await import('../cache/remoteJobsCache.js');

const COLLECTION = 'remoteJobs';
const DB_NAME = 'job-scraper';
const BATCH = 500;
const SAMPLE_SIZE = 10;

const EXECUTE = process.argv.includes('--execute');

// The remote vertical can live on its own cluster; delete where it actually is.
const MONGO_URI = process.env.REMOTE_MONGO_URI || process.env.MONGO_URI;

function chunk(items, size) {
    const out = [];
    for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
    return out;
}

async function run() {
    console.log('🧹 Cleaning location-restricted jobs from remoteJobs');
    console.log(EXECUTE ? '   MODE: --execute (documents WILL be deleted)\n' : '   MODE: dry run (no writes; pass --execute to delete)\n');

    if (!MONGO_URI) throw new Error('Neither REMOTE_MONGO_URI nor MONGO_URI is set');

    const client = new MongoClient(MONGO_URI);
    await client.connect();

    try {
        const db = client.db(DB_NAME);

        const collections = (await db.listCollections().toArray()).map(c => c.name);
        if (!collections.includes(COLLECTION)) {
            console.log(`[Migration] ${COLLECTION} does not exist — nothing to do.`);
            return;
        }

        // JobTitle/Company are pulled purely for the sample log lines.
        const jobs = await db.collection(COLLECTION)
            .find({}, { projection: { _id: 1, Location: 1, WorkplaceType: 1, IsRemote: 1, JobTitle: 1, Company: 1 } })
            .toArray();

        const doomed = jobs.filter(job => !isFullyRemote(job));
        const keep = jobs.length - doomed.length;

        console.log(
            `[Migration] Found ${jobs.length} remote jobs. ${keep} are fully remote. ` +
            `${doomed.length} have location restrictions and will be removed.`
        );

        if (doomed.length === 0) {
            console.log('[Migration] Nothing to delete.');
            return;
        }

        console.log('');
        for (const job of doomed.slice(0, SAMPLE_SIZE)) {
            const loc = job.Location == null ? '(no Location)' : String(job.Location);
            console.log(`[Migration] Deleting: '${loc}' — ${job.JobTitle || '(untitled)'} at ${job.Company || '(unknown)'}`);
        }
        if (doomed.length > SAMPLE_SIZE) {
            console.log(`[Migration] … and ${doomed.length - SAMPLE_SIZE} more`);
        }

        // A breakdown makes a mis-specified rule obvious before it deletes
        // thousands of rows — one glance shows whether the buckets look right.
        const byLocation = new Map();
        for (const job of doomed) {
            const key = job.Location == null || String(job.Location).trim() === ''
                ? '(no Location)'
                : String(job.Location).trim();
            byLocation.set(key, (byLocation.get(key) || 0) + 1);
        }
        const top = [...byLocation.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
        console.log('\n[Migration] Most common rejected Location values:');
        for (const [loc, n] of top) console.log(`[Migration]   ${String(n).padStart(5)}  ${loc}`);

        if (!EXECUTE) {
            console.log(`\n[Migration] Dry run — nothing deleted. Re-run with --execute to remove ${doomed.length} job(s).`);
            return;
        }

        let deleted = 0;
        for (const group of chunk(doomed, BATCH)) {
            const res = await db.collection(COLLECTION).bulkWrite(
                group.map(job => ({ deleteOne: { filter: { _id: job._id } } })),
                { ordered: false },
            );
            deleted += res.deletedCount || 0;
        }

        console.log(`\n[Migration] Deleted ${deleted} non-fully-remote jobs from ${COLLECTION} collection`);
        console.log(`[Migration] ${COLLECTION} now holds ${await db.collection(COLLECTION).countDocuments()} documents`);
    } finally {
        await client.close();
    }
}

run()
    .then(() => process.exit(0))
    .catch(error => {
        console.error('\n❌ Migration failed:', error.message);
        process.exit(1);
    });
