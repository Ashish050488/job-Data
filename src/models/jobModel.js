/**
 * This file defines the schema for a 'Job' and provides a class
 * to create and validate job documents, similar to a Mongoose model.
 */

const jobSchemaDefinition = {
    JobID: { type: String, required: true },
    sourceSite: { type: String, required: true },
    JobTitle: { type: String, required: true, trim: true },
    ApplicationURL: { type: String, required: true },
    Description: { type: String, default: "" },
    GermanRequired: { type: Boolean, default: false },
    Location: { type: String, default: "N/A" },
    Company: { type: String, default: "N/A" },
    Department: { type: String, default: "N/A" },
    ContractType: { type: String, default: "N/A" },
    ExperienceLevel: { type: String, default: "N/A" },
    Compensation: { type: String, default: "N/A" },
    PostedDate: { type: Date, default: null },
    ExpirationDate: { type: Date, default: null },
    createdAt: { type: Date },
    updatedAt: { type: Date },
    isManual: { type: Boolean, default: false },
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

            if (schemaField.required && (!value)) {
                throw new Error(`Validation Error: Missing required field '${key}'.`);
            }

            if (value === undefined || value === null) {
                this[key] = schemaField.default;
            } else {
                if (schemaField.type === String) {
                    this[key] = schemaField.trim ? String(value).trim() : String(value);
                } else if (schemaField.type === Number) {
                    const numValue = Number(value);
                    this[key] = isNaN(numValue) ? schemaField.default : numValue;
                } else if (schemaField.type === Boolean) {
                    this[key] = (typeof value === 'boolean') ? value : Boolean(value);
                } else if (schemaField.type === Date) {
                    const dateObj = new Date(value);
                    if (value && !isNaN(dateObj.getTime())) {
                        this[key] = dateObj;
                    }
                } else {
                    this[key] = value;
                }
            }
        }
    }
}

/**
 * Factory function to create a validated Job object.
 */
export const createJobModel = (mappedJob, siteName) => {
    const combinedData = {
        ...mappedJob,
        sourceSite: siteName,
        GermanRequired: mappedJob.GermanRequired || false,
        isManual: mappedJob.isManual || false, 
        Company: mappedJob.Company || siteName,
    };
    
    return new Job(combinedData);
}