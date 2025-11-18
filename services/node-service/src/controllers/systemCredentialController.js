const db = require('../models');
const crypto = require('crypto');

// Generate a random JWT secret if none exists
async function ensureJwtSecret() {
    try {
        let jwtCredential = await db.SystemCredential.findOne({ where: { key: 'JWT_SECRET' } });
        
        if (!jwtCredential) {
            const randomSecret = crypto.randomBytes(64).toString('hex');
            jwtCredential = await db.SystemCredential.create({
                key: 'JWT_SECRET',
                value: randomSecret,
                description: 'JWT Secret for authentication'
            });
        }
        
        return jwtCredential.value;
    } catch (error) {
        console.error('Error ensuring JWT secret:', error);
        // Fallback to a default secret (not recommended for production)
        return 'fallback-jwt-secret-please-configure-in-ui';
    }
}

// Get system credential by key
exports.getSystemCredential = async (key) => {
    try {
        const credential = await db.SystemCredential.findOne({ where: { key } });
        return credential ? credential.value : null;
    } catch (error) {
        console.error(`Error getting system credential ${key}:`, error);
        return null;
    }
};

// Set system credential
exports.setSystemCredential = async (key, value, description = '') => {
    try {
        const [credential, created] = await db.SystemCredential.findOrCreate({
            where: { key },
            defaults: { key, value, description }
        });
        
        if (!created) {
            credential.value = value;
            credential.description = description;
            await credential.save();
        }
        
        return credential;
    } catch (error) {
        console.error(`Error setting system credential ${key}:`, error);
        throw error;
    }
};

// Get all system credentials (API endpoint)
exports.getAllCredentials = async (req, res) => {
    try {
        const credentials = await db.SystemCredential.findAll({
            attributes: ['id', 'key', 'description', 'createdAt', 'updatedAt']
        });
        
        // Add masked values for security
        const maskedCredentials = credentials.map(cred => ({
            ...cred.toJSON(),
            value: '***HIDDEN***',
            hasValue: true
        }));
        
        res.json(maskedCredentials);
    } catch (error) {
        console.error('Error fetching system credentials:', error);
        res.status(500).json({ error: 'Failed to fetch system credentials' });
    }
};

// Update system credential (API endpoint)
exports.updateCredential = async (req, res) => {
    try {
        const { key, value, description } = req.body;
        
        if (!key || !value) {
            return res.status(400).json({ error: 'Key and value are required' });
        }
        
        const credential = await exports.setSystemCredential(key, value, description);
        
        res.json({ 
            message: 'Credential updated successfully',
            key: credential.key,
            description: credential.description
        });
    } catch (error) {
        console.error('Error updating system credential:', error);
        res.status(500).json({ error: 'Failed to update credential' });
    }
};

// Initialize JWT secret on startup
exports.initializeCredentials = ensureJwtSecret;

module.exports = exports;