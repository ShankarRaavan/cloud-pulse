const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../models');
const systemCredentialController = require('./systemCredentialController');
const User = db.User;

// Dynamic JWT secret from database
async function getJwtSecret() {
    const secret = await systemCredentialController.getSystemCredential('JWT_SECRET');
    return secret || 'fallback-jwt-secret';
}

exports.register = async (req, res) => {
    const { firstName, lastName, email, username, password, confirmPassword } = req.body;
    if (password !== confirmPassword) {
        return res.status(400).json({ message: 'Passwords do not match' });
    }
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({ firstName, lastName, email, username, password: hashedPassword });
        res.status(201).json({ id: user.id, username: user.username });
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({ message: 'Username or email already exists' });
        }
        res.status(400).json({ message: 'Invalid data provided' });
    }
};

exports.login = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        // Handle login with either username or email
        let user = null;
        if (username) {
            user = await User.findOne({ where: { username } });
        } else if (email) {
            user = await User.findOne({ where: { email } });
        }
        
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        if (await bcrypt.compare(password, user.password)) {
            const secretKey = await getJwtSecret();
            const token = jwt.sign({ id: user.id, username: user.username }, secretKey, { expiresIn: '1h' });
            res.json({ token });
        } else {
            res.status(401).json({ message: 'Invalid credentials' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.forgotPassword = async (req, res) => {
    const { email } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    const resetToken = crypto.randomBytes(20).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

    await user.save();

    // In a real application, you would send an email with the reset link
    console.log(`Password reset link: http://localhost:8080/reset-password.html?token=${resetToken}`);

    res.json({ message: 'Password reset link sent to your email' });
};

exports.resetPassword = async (req, res) => {
    const { token, password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
        return res.status(400).json({ message: 'Passwords do not match' });
    }

    const user = await User.findOne({
        where: {
            resetPasswordToken: token,
            resetPasswordExpires: { [db.Sequelize.Op.gt]: Date.now() }
        }
    });

    if (!user) {
        return res.status(400).json({ message: 'Password reset token is invalid or has expired' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;

    await user.save();

    res.json({ message: 'Password has been reset' });
};

exports.authenticate = async (req, res, next) => {
    // Allow WebSocket connections to bypass JWT verification
    if (req.headers.upgrade && req.headers.upgrade.toLowerCase() === 'websocket') {
        return next();
    }

    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        const secretKey = await getJwtSecret();
        jwt.verify(token, secretKey, (err, user) => {
            if (err) {
                console.error('JWT verification error:', err);
                return res.sendStatus(403); // Forbidden
            }
            req.user = user;
            next();
        });
    } else {
        res.sendStatus(401); // Unauthorized
    }
};
