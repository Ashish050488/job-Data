// excelManager.js
import fs from 'fs';
import Exceljs from 'exceljs';

const excelFile = "All_Jobs.xlsx";

function addHeaders(ws) {
    ws.columns = [
        { header: "Job Title", key: "JobTitle", width: 70 },
        { header: "Job ID", key: "JobID", width: 20 },
        { header: "Compensation", key: "Compensation", width: 50 },
        { header: "Location", key: "Location", width: 40 },
        { header: "Posting Date", key: "PostingDate", width: 20 },
        { header: "Expiration Date", key: "ExpirationDate", width: 20 },
        { header: "Department", key: "Department", width: 30 },
        { header: "Description", key: "Description", width: 100 },
        { header: "Application URL", key: "ApplicationURL", width: 80 },
        { header: "Contract Type", key: "ContractType", width: 20 },
        { header: "Experience Level", key: "ExperienceLevel", width: 20 },
         { header: 'Experience Level', key: 'ExperienceLevel', width: 20 },
    // ✅ NEW COLUMN ADDED HERE
    { header: 'Estimated Years of Experience', key: 'estimatedYearsOfExperience', width: 20 },
        { header: "German Required", key: "GermanRequired", width: 20 },
        { header: "Summary", key: "Summary", width: 250 },
    ];
}

export async function loadAllExistingIDs() {
    const workbook = new Exceljs.Workbook();
    if (!fs.existsSync(excelFile)) {
        return new Map();
    }
    await workbook.xlsx.readFile(excelFile);
    const allIDs = new Map();

    workbook.eachSheet((worksheet, sheetId) => {
        const ids = new Set();
        const jobIDCol = worksheet.getColumn('B'); // Assuming Job ID is always in column B
        jobIDCol.eachCell({ includeEmpty: false }, (cell, rowNumber) => {
            if (rowNumber > 1) { // Skip header row
                ids.add(cell.value.toString().trim());
            }
        });
        allIDs.set(worksheet.name, ids);
        console.log(`[${worksheet.name}] Found ${ids.size} existing jobs in the Excel file.`);
    });
    return allIDs;
}

// ✅ NEW, SAFER FUNCTION
export async function appendJobs(siteName, newJobs) {
    const workbook = new Exceljs.Workbook();
    if (fs.existsSync(excelFile)) {
        await workbook.xlsx.readFile(excelFile);
    }

    let worksheet = workbook.getWorksheet(siteName);
    if (!worksheet) {
        worksheet = workbook.addWorksheet(siteName);
        addHeaders(worksheet);
    }

    worksheet.addRows(newJobs);
    await workbook.xlsx.writeFile(excelFile);
}
