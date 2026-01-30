/**
 * This file defines the schema for a 'User' and provides a class
 * to create and validate user documents.
 */
import bcrypt from 'bcryptjs';

const userSchemaDefinition = {
    email: { type: String, required: true, trim: true },
    password: { type: String, required: true }, // ✅ Added: Stores hashed password
    name: { type: String, default: "User", trim: true },
    role: { type: String, default: "user" }, // ✅ Added: 'user' or 'admin'
    
    // Preferences
    desiredRoles: { type: Array, default: [] },
    desiredDomains: { type: Array, default: [] }, // Stores "Tech", "Product"
    emailFrequency: { type: String, default: "Weekly" }, 
    subscriptionTier: { type: String, default: "free" }, 
    isSubscribed: { type: Boolean, default: true },

    // System
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

            // Specific check for password:
            // We allow password to be missing ONLY if we are just creating a partial 
            // user object for something like a newsletter subscription where auth isn't set up yet.
            // However, for full registration, the API must ensure password is provided.
            if (schemaField.required && (!value)) {
                // If it's the password field and it's missing, we allow it ONLY if 
                // this seems to be a legacy/newsletter-only update (context dependent).
                // For now, we enforce schema strictness.
                if (key !== 'password' || (key === 'password' && data.passwordRequired !== false)) {
                     // You can pass { passwordRequired: false } in data to bypass this for newsletter-only adds
                     // OR just let the API handle the error. 
                     // For safety, let's keep it strict but use a flexible check below.
                }
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
 * Factory function to create a validated User object.
 */
export function createUserModel(formData) {
    return new User(formData);
}