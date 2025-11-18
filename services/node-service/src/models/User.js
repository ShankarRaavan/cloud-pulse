module.exports = (sequelize, DataTypes) => {
    const User = sequelize.define('User', {
        firstName: { type: DataTypes.STRING, allowNull: true },
        lastName: { type: DataTypes.STRING, allowNull: true },
        email: { type: DataTypes.STRING, allowNull: false, unique: true, validate: { isEmail: true } },
        username: { type: DataTypes.STRING, allowNull: false, unique: true },
        password: { type: DataTypes.STRING, allowNull: true }, // Allow null for OAuth users
        resetPasswordToken: { type: DataTypes.STRING, allowNull: true },
        resetPasswordExpires: { type: DataTypes.DATE, allowNull: true },
        
        // OAuth provider IDs
        googleId: { type: DataTypes.STRING, allowNull: true },
        githubId: { type: DataTypes.STRING, allowNull: true },
        microsoftId: { type: DataTypes.STRING, allowNull: true },
        
        // Additional user info
        profilePicture: { type: DataTypes.STRING, allowNull: true },
        emailVerified: { type: DataTypes.BOOLEAN, defaultValue: false },
        authProvider: { 
            type: DataTypes.STRING, 
            allowNull: true,
            comment: 'local, google, github, microsoft'
        },
        
        // Security and tracking
        lastLoginAt: { type: DataTypes.DATE, allowNull: true },
        lastLoginIp: { type: DataTypes.STRING, allowNull: true }
    });
    return User;
};
