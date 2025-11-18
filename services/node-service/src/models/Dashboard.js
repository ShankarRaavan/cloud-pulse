module.exports = (sequelize, DataTypes) => {
    const Dashboard = sequelize.define('Dashboard', {
        id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
        name: { type: DataTypes.STRING, allowNull: false },
        config: { type: DataTypes.JSON, allowNull: false }
    });
    return Dashboard;
};
