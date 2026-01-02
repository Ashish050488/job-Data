/**
 * This file defines the schema for a 'Job' and provides a class
 * to create and validate job documents.
 */

const jobSchemaDefinition = {
    JobID: { type: String, required: true },
    sourceSite: { type: String, required: true },
    JobTitle: { type: String, required: true, trim: true },
    ApplicationURL: { type: String, required: true },
    Description: { type: String, default: "" },
    Location: { type: String, default: "N/A" },
    Company: { type: String, default: "N/A" },
    
    // --- NEW CLASSIFICATION FIELDS ---
    GermanRequired: { type: Boolean, default: false }, // AI Decision
    Domain: { type: String, default: "Unclear" },      // Technical / Non-Technical
    SubDomain: { type: String, default: "Other" },     // Backend, Product, etc.
    ConfidenceScore: { type: Number, default: 0 },     // 0.0 to 1.0
    Status: { type: String, default: "review" },       // approved, review, rejected
    RejectionReason: { type: String, default: null },
    // ----------------------------------

    Department: { type: String, default: "N/A" },
    ContractType: { type: String, default: "N/A" },
    ExperienceLevel: { type: String, default: "N/A" },
    Compensation: { type: String, default: "N/A" },
    PostedDate: { type: Date, default: null },
    createdAt: { type: Date },
    updatedAt: { type: Date },
    isManual: { type: Boolean, default: false },
    thumbStatus: { type: String, default: null } 
};

class Job {
    constructor(data) {
        this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
        this.updatedAt = new Date(); 
        this.scrapedAt = new Date();

        for (const key in jobSchemaDefinition) {
            if (key === 'createdAt' || key === 'updatedAt') continue;

            const schemaField = jobSchemaDefinition[key];
            let value = data[key];

            // Provide defaults
            if (value === undefined || value === null) {
                this[key] = schemaField.default;
            } else {
                // Simple type conversion
                if (schemaField.type === String) {
                    this[key] = schemaField.trim ? String(value).trim() : String(value);
                } else if (schemaField.type === Number) {
                    const numValue = Number(value);
                    this[key] = isNaN(numValue) ? schemaField.default : numValue;
                } else if (schemaField.type === Boolean) {
                    this[key] = Boolean(value);
                } else if (schemaField.type === Date) {
                    const dateObj = new Date(value);
                    this[key] = (value && !isNaN(dateObj.getTime())) ? dateObj : null;
                } else {
                    this[key] = value;
                }
            }
        }
    }
}

export const createJobModel = (mappedJob, siteName) => {
    return new Job({
        ...mappedJob,
        sourceSite: siteName,
        isManual: mappedJob.isManual || false, 
        Company: mappedJob.Company || siteName,
    });
}