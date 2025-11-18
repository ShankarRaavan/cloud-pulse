const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const MicrosoftStrategy = require('passport-microsoft').Strategy;
const db = require('../models');

// Serialize user for session
passport.serializeUser((user, done) => {
    done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
    try {
        const user = await db.User.findByPk(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

// Google OAuth Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && 
    process.env.GOOGLE_CLIENT_ID !== 'your_google_client_id_here') {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:8080/api/auth/google/callback',
        scope: ['profile', 'email']
    },
    async (accessToken, refreshToken, profile, done) => {
        try {
            // Check if user exists with this Google ID
            let user = await db.User.findOne({ 
                where: { googleId: profile.id } 
            });

            if (user) {
                // User exists, update last login
                user.lastLoginAt = new Date();
                await user.save();
                return done(null, user);
            }

            // Check if user exists with the same email
            const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
            if (email) {
                user = await db.User.findOne({ where: { email } });
                if (user) {
                    // Link Google account to existing user
                    user.googleId = profile.id;
                    user.lastLoginAt = new Date();
                    await user.save();
                    return done(null, user);
                }
            }

            // Create new user
            const newUser = await db.User.create({
                googleId: profile.id,
                email: email,
                username: profile.displayName || email?.split('@')[0] || `google_${profile.id}`,
                firstName: profile.name?.givenName || '',
                lastName: profile.name?.familyName || '',
                profilePicture: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
                emailVerified: true,
                authProvider: 'google',
                lastLoginAt: new Date()
            });

            return done(null, newUser);
        } catch (error) {
            console.error('Google OAuth error:', error);
            return done(error, null);
        }
    }));
}

// GitHub OAuth Strategy
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET && 
    process.env.GITHUB_CLIENT_ID !== 'your_github_client_id_here') {
    passport.use(new GitHubStrategy({
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: process.env.GITHUB_CALLBACK_URL || 'http://localhost:8080/api/auth/github/callback',
        scope: ['user:email']
    },
    async (accessToken, refreshToken, profile, done) => {
        try {
            // Check if user exists with this GitHub ID
            let user = await db.User.findOne({ 
                where: { githubId: profile.id } 
            });

            if (user) {
                // User exists, update last login
                user.lastLoginAt = new Date();
                await user.save();
                return done(null, user);
            }

            // Get primary email from profile
            const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
            
            // Check if user exists with the same email
            if (email) {
                user = await db.User.findOne({ where: { email } });
                if (user) {
                    // Link GitHub account to existing user
                    user.githubId = profile.id;
                    user.lastLoginAt = new Date();
                    await user.save();
                    return done(null, user);
                }
            }

            // Create new user
            const newUser = await db.User.create({
                githubId: profile.id,
                email: email,
                username: profile.username || `github_${profile.id}`,
                firstName: profile.displayName ? profile.displayName.split(' ')[0] : profile.username,
                lastName: profile.displayName ? profile.displayName.split(' ').slice(1).join(' ') : '',
                profilePicture: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
                emailVerified: email ? true : false,
                authProvider: 'github',
                lastLoginAt: new Date()
            });

            return done(null, newUser);
        } catch (error) {
            console.error('GitHub OAuth error:', error);
            return done(error, null);
        }
    }));
}

// Microsoft OAuth Strategy
if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET && 
    process.env.MICROSOFT_CLIENT_ID !== 'your_microsoft_client_id_here') {
    passport.use(new MicrosoftStrategy({
        clientID: process.env.MICROSOFT_CLIENT_ID,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
        callbackURL: process.env.MICROSOFT_CALLBACK_URL || 'http://localhost:8080/api/auth/microsoft/callback',
        scope: ['user.read']
    },
    async (accessToken, refreshToken, profile, done) => {
        try {
            // Check if user exists with this Microsoft ID
            let user = await db.User.findOne({ 
                where: { microsoftId: profile.id } 
            });

            if (user) {
                // User exists, update last login
                user.lastLoginAt = new Date();
                await user.save();
                return done(null, user);
            }

            // Get email from profile
            const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
            
            // Check if user exists with the same email
            if (email) {
                user = await db.User.findOne({ where: { email } });
                if (user) {
                    // Link Microsoft account to existing user
                    user.microsoftId = profile.id;
                    user.lastLoginAt = new Date();
                    await user.save();
                    return done(null, user);
                }
            }

            // Create new user
            const newUser = await db.User.create({
                microsoftId: profile.id,
                email: email,
                username: profile.displayName?.replace(/\s+/g, '_').toLowerCase() || `microsoft_${profile.id}`,
                firstName: profile.name?.givenName || profile.displayName?.split(' ')[0] || '',
                lastName: profile.name?.familyName || profile.displayName?.split(' ').slice(1).join(' ') || '',
                profilePicture: null, // Microsoft doesn't provide photo in basic scope
                emailVerified: email ? true : false,
                authProvider: 'microsoft',
                lastLoginAt: new Date()
            });

            return done(null, newUser);
        } catch (error) {
            console.error('Microsoft OAuth error:', error);
            return done(error, null);
        }
    }));
}

module.exports = passport;
