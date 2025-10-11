// runMatcher.js
import { getSubscribedUsers, findMatchingJobs, updateUserAfterEmail } from './databaseManager.js';
import { sendEmailNotification } from './emailManager.js';

async function runMatcherAndSendEmails() {
    console.log("🏃‍♂️ Starting the job matcher and email sender...");

    const users = await getSubscribedUsers();
    if (users.length === 0) {
        console.log("No subscribed users found. Exiting.");
        return;
    }

    console.log(`Found ${users.length} users to process.`);

    for (const user of users) {
        console.log(`\n🔎 Finding matches for ${user.name} (${user.email})...`);
        
        const matchingJobs = await findMatchingJobs(user);

        if (matchingJobs.length === 0) {
            console.log(`No new matching jobs found for ${user.name}.`);
            continue;
        }

        const emailSent = await sendEmailNotification(user, matchingJobs);

        if (emailSent) {
            const sentJobIds = matchingJobs.map(job => job.JobID);
            await updateUserAfterEmail(user._id, sentJobIds);
            console.log(`Updated database for ${user.name}.`);
        }
    }

    console.log("\n✅ All users processed. Matcher finished.");
    process.exit(0); // Exit the script cleanly
}

runMatcherAndSendEmails();