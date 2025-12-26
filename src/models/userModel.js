/**
 * This file defines the schema for a 'User' and provides a class
 * to create and validate user documents, similar to a Mongoose model.
 */

const userSchemaDefinition = {
    email: { type: String, required: true, trim: true },
    name: { type: String, default: "Subscriber", trim: true }, // Changed default
    desiredRoles: { type: Array, default: [] },
    
    // --- NEW FIELDS ---
    desiredDomains: { type: Array, default: [] }, // Stores "Tech", "Product"
    emailFrequency: { type: String, default: "Weekly" }, 
    subscriptionTier: { type: String, default: "free" }, 
    // ------------------

    isSubscribed: { type: Boolean, default: true },
    lastEmailSent: { type: Date, default: null },
    sentJobIds: { type: Array, default: [] },
    createdAt: { type: Date },
    updatedAt: { type: Date },
};

class User {
    constructor(data) {
        this.createdAt = data.createdAt || new Date();
        this.updatedAt = new Date();

        for (const key in userSchemaDefinition) {
            if (key === 'createdAt' || key === 'updatedAt') continue;

            const schemaField = userSchemaDefinition[key];
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

/**
 * Factory function to create a validated User object from raw form data.
 * @param {object} formData - The data from a form or import script.
 * @returns {object} A new, validated User instance.
 */
export function createUserModel(formData) {
    return new User(formData);
}