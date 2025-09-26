// testEmailFromExcel.js
import Exceljs from 'exceljs';
import fs from 'fs';
import { sendEmailNotification } from './emailManager.js';

const excelFile = "All_Jobs.xlsx";
const sheetName = "ALDI SÜD";

async function runFilteredEmailTest() {
    console.log(`🚀 Starting test: Read from Excel, filter, and email.`);

    if (!fs.existsSync(excelFile)) {
        console.error(`❌ Error: The file '${excelFile}' was not found.`);
        return;
    }

    const workbook = new Exceljs.Workbook();
    await workbook.xlsx.readFile(excelFile);
    const worksheet = workbook.getWorksheet(sheetName);

    if (!worksheet) {
        console.error(`❌ Error: Worksheet named '${sheetName}' not found.`);
        return;
    }

    const allJobs = [];
    const headerMap = {};

    // Step 1: Create a map of Column Number -> Header Key (e.g., 12 -> "GermanRequired")
    // This is the reliable way to map headers.
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
        const key = cell.value.toString().replace(/\s+/g, '');
        headerMap[colNumber] = key;
    });

    // Step 2: Read each data row using the header map
    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) { // Skip header row
            const jobData = {};
            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                const headerKey = headerMap[colNumber];
                // Use cell.text to get a clean string value, which works well for links too.
                jobData[headerKey] = cell.text;
            });
            allJobs.push(jobData);
        }
    });

    console.log(`\n--- [DEBUGGING] Reading 'GermanRequired' values ---`);
    allJobs.forEach(job => {
        console.log(`- Title: ${job.JobTitle?.substring(0, 30)}... | German Required: [${job.GermanRequired}]`);
    });
    console.log(`--------------------------------------------------\n`);

    // Step 3: Use the smarter filter
    const filteredJobs = allJobs.filter(job => {
        const germanStatus = (job.GermanRequired || '').trim().toLowerCase();
        return germanStatus === 'no';
    });

    if (filteredJobs.length === 0) {
        console.log("🟡 No jobs found that match the filter. No email will be sent.");
        return;
    }

    console.log(`✅ Found ${filteredJobs.length} jobs that do not require German.`);

    const jobsToSend = new Map();
    jobsToSend.set(`${sheetName} `, filteredJobs);

    await sendEmailNotification(jobsToSend);

    console.log("\n✅ Filtered email test finished.");
}

runFilteredEmailTest();