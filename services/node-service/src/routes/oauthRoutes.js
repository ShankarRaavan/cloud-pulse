const express = require('express');
const router = express.Router();
const passport = require('../config/passport');
const oauthController = require('../controllers/oauthController');

// Google OAuth routes
router.get('/google', (req, res, next) => {
    // Check if Google strategy is configured
    if (!process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID === 'your_google_client_id_here') {
        return res.redirect('/index.html?error=oauth_not_configured&provider=google');
    }
    passport.authenticate('google', { 
        scope: ['profile', 'email'],
        session: false 
    })(req, res, next);
});

router.get('/google/callback',
    passport.authenticate('google', { 
        failureRedirect: '/index.html?error=google_auth_failed',
        session: false 
    }),
    oauthController.googleCallback
);

// GitHub OAuth routes
router.get('/github', (req, res, next) => {
    // Check if GitHub strategy is configured
    if (!process.env.GITHUB_CLIENT_ID || process.env.GITHUB_CLIENT_ID === 'your_github_client_id_here') {
        return res.redirect('/index.html?error=oauth_not_configured&provider=github');
    }
    passport.authenticate('github', { 
        scope: ['user:email'],
        session: false 
    })(req, res, next);
});

router.get('/github/callback',
    passport.authenticate('github', { 
        failureRedirect: '/index.html?error=github_auth_failed',
        session: false 
    }),
    oauthController.githubCallback
);

// Microsoft OAuth routes
router.get('/microsoft', (req, res, next) => {
    // Check if Microsoft strategy is configured
    if (!process.env.MICROSOFT_CLIENT_ID || process.env.MICROSOFT_CLIENT_ID === 'your_microsoft_client_id_here') {
        return res.redirect('/index.html?error=oauth_not_configured&provider=microsoft');
    }
    passport.authenticate('microsoft', { 
        scope: ['user.read'],
        session: false 
    })(req, res, next);
});

router.get('/microsoft/callback',
    passport.authenticate('microsoft', { 
        failureRedirect: '/index.html?error=microsoft_auth_failed',
        session: false 
    }),
    oauthController.microsoftCallback
);

module.exports = router;
