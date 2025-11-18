module.exports = (sequelize, DataTypes) => {
    const SystemCredential = sequelize.define('SystemCredential', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        key: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        value: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        description: {
            type: DataTypes.STRING,
            allowNull: true
        },
        isEncrypted: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        }
    });

    return SystemCredential;
};