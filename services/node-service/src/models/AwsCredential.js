module.exports = (sequelize, DataTypes) => {
    const AwsCredential = sequelize.define('AwsCredential', {
        id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
        aws_access_key_id: { type: DataTypes.STRING, allowNull: false },
        aws_secret_access_key: { type: DataTypes.STRING, allowNull: false },
        aws_default_region: { type: DataTypes.STRING, allowNull: false },
    });
    return AwsCredential;
};
