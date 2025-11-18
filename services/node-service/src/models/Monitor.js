module.exports = (sequelize, DataTypes) => {
    const Monitor = sequelize.define('Monitor', {
        id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
        name: { type: DataTypes.STRING, allowNull: false },
        url: { type: DataTypes.STRING, allowNull: false },
        method: { type: DataTypes.STRING, defaultValue: 'GET' },
        requestBody: { type: DataTypes.TEXT }, // Stored as JSON string
        customHeaders: { type: DataTypes.TEXT }, // Stored as JSON string
        authType: { type: DataTypes.STRING, defaultValue: 'NONE' },
        authUsername: { type: DataTypes.STRING },
        authPassword: { type: DataTypes.STRING },
        bearerToken: { type: DataTypes.STRING },
        credentialId: {
            type: DataTypes.UUID,
            references: {
                model: 'ApiCredentials', // This is the table name
                key: 'id'
            }
        },
        monitoringInterval: { type: DataTypes.INTEGER, defaultValue: 300 }, // In seconds, default 5 minutes
        region: { type: DataTypes.STRING, defaultValue: 'Default' },
        retryCount: { type: DataTypes.INTEGER, defaultValue: 0 }, // Number of retries before marking as failed
        requestTimeout: { type: DataTypes.INTEGER, defaultValue: 30 }, // Request timeout in seconds
        alertThreshold: { type: DataTypes.INTEGER, defaultValue: 1 }, // Consecutive failures before alerting
        
        // AWS-specific fields
        monitorType: { type: DataTypes.STRING }, // 'aws', 'http', 'api', etc.
        resourceType: { type: DataTypes.STRING }, // 'ec2', 'rds', 'lambda', 's3'
        resourceId: { type: DataTypes.STRING }, // AWS resource identifier (legacy - single resource)
        resourceIds: { type: DataTypes.TEXT }, // JSON array of resource IDs for multi-resource monitoring
        resourceNames: { type: DataTypes.TEXT }, // JSON array of resource names for display
        metricName: { type: DataTypes.STRING }, // CloudWatch metric name
        metricNamespace: { type: DataTypes.STRING }, // CloudWatch namespace
        metricDimensions: { type: DataTypes.TEXT }, // JSON string of dimensions
        thresholdOperator: { type: DataTypes.STRING }, // '>', '<', '>=', '<='
        thresholdValue: { type: DataTypes.FLOAT },
        isEnabled: { type: DataTypes.BOOLEAN, defaultValue: true },
        
        // In-memory state, not stored in DB
        status: { type: DataTypes.VIRTUAL, defaultValue: 'Pending' },
        history: { type: DataTypes.VIRTUAL, defaultValue: [] }
    });
    return Monitor;
};
