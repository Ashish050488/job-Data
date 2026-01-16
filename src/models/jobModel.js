/**
 * This file defines the schema for a 'Job' and provides a class
 * to create and validate job documents.
 */

/**
 * This file defines the schema for a 'Job'
 */

const jobSchemaDefinition = {
    JobID: { type: String, required: true },
    sourceSite: { type: String, required: true },
    JobTitle: { type: String, required: true, trim: true },
    ApplicationURL: { type: String, required: true },
    Description: { type: String, default: "" },
    Location: { type: String, default: "N/A" },
    Company: { type: String, default: "N/A" },
    
    // --- CLASSIFICATION FIELDS ---
    GermanRequired: { type: Boolean, default: false },
    Domain: { type: String, default: "Unclear" },
    SubDomain: { type: String, default: "Other" },
    ConfidenceScore: { type: Number, default: 0 },
    
    // --- WORKFLOW STATUS ---
    // 'pending_review' = Waiting for human check
    // 'active'         = Live on website
    // 'rejected'       = Hidden (but ID kept for deduplication)
    Status: { type: String, default: "pending_review" }, 

    Department: { type: String, default: "N/A" },
    ContractType: { type: String, default: "N/A" },
    ExperienceLevel: { type: String, default: "N/A" },
    PostedDate: { type: Date, default: null },
    createdAt: { type: Date },
    updatedAt: { type: Date },
    scrapedAt: { type: Date },
    thumbStatus: { type: String, default: null } 
};

class Job {
    constructor(data) {
        this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
        this.updatedAt = new Date(); 
        this.scrapedAt = new Date();

        for (const key in jobSchemaDefinition) {
            if (key === 'createdAt' || key === 'updatedAt' || key === 'scrapedAt') continue;

            const schemaField = jobSchemaDefinition[key];
            let value = data[key];

            if (value === undefined || value === null) {
                this[key] = schemaField.default;
            } else {
                if (schemaField.type === String) {
                    this[key] = schemaField.trim ? String(value).trim() : String(value);
                } else if (schemaField.type === Number) {
                    this[key] = Number(value) || schemaField.default;
                } else if (schemaField.type === Boolean) {
                    this[key] = Boolean(value);
                } else if (schemaField.type === Date) {
                    this[key] = new Date(value);
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
        Company: mappedJob.Company || siteName,
    });
}