module.exports = (sequelize, DataTypes) => {
    const Notification = sequelize.define('Notification', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        type: { type: DataTypes.STRING, allowNull: false }, // e.g., 'Email', 'Slack', 'Webhook'
        config: { type: DataTypes.TEXT, allowNull: false }, // Stored as JSON string
        isEnabled: { type: DataTypes.BOOLEAN, defaultValue: true }
    });
    return Notification;
};
