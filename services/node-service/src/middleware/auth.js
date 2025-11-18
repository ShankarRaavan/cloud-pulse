const jwt = require('jsonwebtoken');
const db = require('../models');
const systemCredentialController = require('../controllers/systemCredentialController');

const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access token required' });
    }

    try {
        // Get JWT secret from database
        const jwtSecret = await systemCredentialController.getSystemCredential('JWT_SECRET');
        if (!jwtSecret) {
            console.error('JWT_SECRET not found in system credentials');
            return res.status(500).json({ message: 'Server configuration error' });
        }

        // Verify token
        const decoded = jwt.verify(token, jwtSecret);
        
        // Get user from database
        const user = await db.User.findByPk(decoded.id);
        if (!user) {
            return res.status(401).json({ message: 'Invalid token - user not found' });
        }

        // Attach user to request
        req.user = user;
        next();
    } catch (error) {
        console.error('Token verification error:', error);
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expired' });
        }
        return res.status(401).json({ message: 'Invalid token' });
    }
};

module.exports = authenticateToken;
