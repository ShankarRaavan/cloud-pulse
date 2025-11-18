const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: '/app/data/database.sqlite'
});

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

db.User = require('./User')(sequelize, DataTypes);
db.Monitor = require('./Monitor')(sequelize, DataTypes);
db.History = require('./History')(sequelize, DataTypes);
db.Notification = require('./Notification')(sequelize, DataTypes);
db.Automation = require('./Automation')(sequelize, DataTypes);
db.Dashboard = require('./Dashboard')(sequelize, DataTypes);
db.ApiCredential = require('./ApiCredential')(sequelize, DataTypes);
db.AwsCredential = require('./AwsCredential')(sequelize, DataTypes);
db.AzureCredential = require('./AzureCredential')(sequelize, DataTypes);
db.SystemCredential = require('./SystemCredential')(sequelize, DataTypes);
db.MetricsHistory = require('./MetricsHistory')(sequelize, DataTypes);

// Associations
db.Monitor.hasMany(db.History, { as: 'historyRecords', foreignKey: 'monitorId' });
db.History.belongsTo(db.Monitor, { foreignKey: 'monitorId', onDelete: 'CASCADE' });

const MonitorNotification = sequelize.define('MonitorNotification', {});
db.Monitor.belongsToMany(db.Notification, { through: MonitorNotification });
db.Notification.belongsToMany(db.Monitor, { through: MonitorNotification });

db.ApiCredential.hasMany(db.Monitor, { foreignKey: 'credentialId' });
db.Monitor.belongsTo(db.ApiCredential, { foreignKey: 'credentialId' });

// MetricsHistory associations
db.User.hasMany(db.MetricsHistory, { as: 'metricsHistory', foreignKey: 'userId' });
db.MetricsHistory.belongsTo(db.User, { foreignKey: 'userId', onDelete: 'SET NULL' });

module.exports = db;
