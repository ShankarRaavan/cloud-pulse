module.exports = (sequelize, DataTypes) => {
    const History = sequelize.define('History', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        monitorId: { type: DataTypes.UUID, allowNull: false, references: { model: 'Monitors', key: 'id' } },
        status: { type: DataTypes.STRING, allowNull: false },
        statusCode: { type: DataTypes.INTEGER },
        responseTime: { type: DataTypes.INTEGER },
        dataLength: { type: DataTypes.INTEGER },
        message: { type: DataTypes.STRING }
    });
    return History;
};
