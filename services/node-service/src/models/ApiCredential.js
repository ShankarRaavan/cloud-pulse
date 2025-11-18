module.exports = (sequelize, DataTypes) => {
    const ApiCredential = sequelize.define('ApiCredential', {
        id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
        name: { type: DataTypes.STRING, allowNull: false, unique: true },
        grantType: { type: DataTypes.STRING, allowNull: false, defaultValue: 'password_credentials' },
        clientId: { type: DataTypes.STRING, allowNull: false },
        clientSecret: { type: DataTypes.STRING, allowNull: true },
        username: { type: DataTypes.STRING, allowNull: true },
        password: { type: DataTypes.STRING, allowNull: true },
        tokenUrl: { type: DataTypes.STRING, allowNull: false },
        scopes: { type: DataTypes.STRING, allowNull: true } // Comma-separated list of scopes
    });
    return ApiCredential;
};
