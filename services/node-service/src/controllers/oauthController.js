const jwt = require('jsonwebtoken');
const db = require('../models');

// Generate JWT token
function generateToken(user) {
    return jwt.sign(
        { 
            id: user.id, 
            username: user.username,
            email: user.email 
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '7d' }
    );
}

// Google OAuth initiation
exports.googleAuth = (req, res, next) => {
    // This is handled by Passport.js middleware
};

// Google OAuth callback
exports.googleCallback = async (req, res) => {
    try {
        if (!req.user) {
            return res.redirect('/index.html?error=auth_failed&message=' + encodeURIComponent('Authentication failed'));
        }

        // Generate JWT token
        const token = generateToken(req.user);

        // Log login activity
        await logLoginActivity(req.user.id, req);

        // Redirect to frontend with token
        res.redirect(`/index.html?token=${token}`);
    } catch (error) {
        console.error('Google callback error:', error);
        res.redirect('/index.html?error=server_error&message=' + encodeURIComponent('Server error during authentication'));
    }
};

// GitHub OAuth initiation
exports.githubAuth = (req, res, next) => {
    // This is handled by Passport.js middleware
};

// GitHub OAuth callback
exports.githubCallback = async (req, res) => {
    try {
        if (!req.user) {
            return res.redirect('/index.html?error=auth_failed&message=' + encodeURIComponent('Authentication failed'));
        }

        // Generate JWT token
        const token = generateToken(req.user);

        // Log login activity
        await logLoginActivity(req.user.id, req);

        // Redirect to frontend with token
        res.redirect(`/index.html?token=${token}`);
    } catch (error) {
        console.error('GitHub callback error:', error);
        res.redirect('/index.html?error=server_error&message=' + encodeURIComponent('Server error during authentication'));
    }
};

// Microsoft OAuth initiation
exports.microsoftAuth = (req, res, next) => {
    // This is handled by Passport.js middleware
};

// Microsoft OAuth callback
exports.microsoftCallback = async (req, res) => {
    try {
        if (!req.user) {
            return res.redirect('/index.html?error=auth_failed&message=' + encodeURIComponent('Authentication failed'));
        }

        // Generate JWT token
        const token = generateToken(req.user);

        // Log login activity
        await logLoginActivity(req.user.id, req);

        // Redirect to frontend with token
        res.redirect(`/index.html?token=${token}`);
    } catch (error) {
        console.error('Microsoft callback error:', error);
        res.redirect('/index.html?error=server_error&message=' + encodeURIComponent('Server error during authentication'));
    }
};

// Helper function to log login activity
async function logLoginActivity(userId, req) {
    try {
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('user-agent') || '';
        
        // You can expand this to store in LoginHistory model
        const user = await db.User.findByPk(userId);
        if (user) {
            user.lastLoginAt = new Date();
            user.lastLoginIp = ipAddress;
            await user.save();
        }
    } catch (error) {
        console.error('Error logging login activity:', error);
    }
}

module.exports = exports;
