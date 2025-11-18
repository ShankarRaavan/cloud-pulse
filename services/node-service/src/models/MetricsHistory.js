module.exports = (sequelize, DataTypes) => {
    const MetricsHistory = sequelize.define('MetricsHistory', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        
        // Source identification
        source: {
            type: DataTypes.ENUM('aws', 'azure', 'gcp'),
            allowNull: false,
            comment: 'Cloud provider source'
        },
        
        service: {
            type: DataTypes.ENUM('ec2', 'rds', 'lambda', 's3', 'cloudwatch', 'compute', 'storage', 'database'),
            allowNull: false,
            comment: 'Cloud service type'
        },
        
        resourceId: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: 'Resource identifier (instance-id, db-identifier, etc.)'
        },
        
        resourceName: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Human-readable resource name'
        },
        
        region: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: 'Cloud region'
        },
        
        // Metric information
        metricName: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: 'Name of the metric (CPUUtilization, NetworkIn, etc.)'
        },
        
        metricUnit: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Unit of measurement (Percent, Bytes, Count, etc.)'
        },
        
        metricValue: {
            type: DataTypes.DECIMAL(15, 6),
            allowNull: false,
            comment: 'Numeric value of the metric'
        },
        
        // Temporal information
        timestamp: {
            type: DataTypes.DATE,
            allowNull: false,
            comment: 'When the metric was recorded'
        },
        
        collectedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
            comment: 'When we collected this metric'
        },
        
        // Statistical aggregation
        period: {
            type: DataTypes.INTEGER,
            allowNull: false,
            comment: 'Period in seconds for aggregation'
        },
        
        statistic: {
            type: DataTypes.ENUM('Average', 'Sum', 'Maximum', 'Minimum', 'SampleCount'),
            allowNull: false,
            defaultValue: 'Average',
            comment: 'Statistical aggregation type'
        },
        
        // Additional metadata
        dimensions: {
            type: DataTypes.JSON,
            allowNull: true,
            comment: 'Additional metric dimensions as JSON'
        },
        
        tags: {
            type: DataTypes.JSON,
            allowNull: true,
            comment: 'Resource tags as JSON'
        },
        
        // Quality and reliability indicators
        dataQuality: {
            type: DataTypes.ENUM('high', 'medium', 'low'),
            allowNull: false,
            defaultValue: 'high',
            comment: 'Data quality assessment'
        },
        
        isAnomaly: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            comment: 'Whether this metric point is flagged as anomalous'
        },
        
        anomalyScore: {
            type: DataTypes.DECIMAL(5, 4),
            allowNull: true,
            comment: 'Anomaly detection score (0-1)'
        },
        
        // User association
        userId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: 'User who owns this resource'
        }
    }, {
        tableName: 'metrics_history',
        timestamps: true,
        indexes: [
            {
                name: 'idx_source_service_resource',
                fields: ['source', 'service', 'resourceId']
            },
            {
                name: 'idx_timestamp_metric',
                fields: ['timestamp', 'metricName']
            },
            {
                name: 'idx_region_service',
                fields: ['region', 'service']
            },
            {
                name: 'idx_anomaly',
                fields: ['isAnomaly', 'anomalyScore']
            },
            {
                name: 'idx_collected_at',
                fields: ['collectedAt']
            },
            {
                name: 'idx_user_timestamp',
                fields: ['userId', 'timestamp']
            }
        ]
    });

    // Class methods for data analysis
    MetricsHistory.getMetricsSummary = async function(filters = {}) {
        const {
            source,
            service,
            resourceId,
            metricName,
            startTime,
            endTime,
            userId
        } = filters;

        const whereClause = {};
        if (source) whereClause.source = source;
        if (service) whereClause.service = service;
        if (resourceId) whereClause.resourceId = resourceId;
        if (metricName) whereClause.metricName = metricName;
        if (userId) whereClause.userId = userId;
        
        if (startTime && endTime) {
            whereClause.timestamp = {
                [sequelize.Sequelize.Op.between]: [startTime, endTime]
            };
        }

        return await this.findAll({
            where: whereClause,
            order: [['timestamp', 'ASC']],
            attributes: [
                'timestamp',
                'metricValue',
                'metricUnit',
                'resourceId',
                'resourceName',
                'isAnomaly',
                'anomalyScore'
            ]
        });
    };

    MetricsHistory.getAnomalies = async function(filters = {}) {
        const {
            source,
            service,
            startTime,
            endTime,
            userId,
            minAnomalyScore = 0.7
        } = filters;

        const whereClause = {
            isAnomaly: true,
            anomalyScore: {
                [sequelize.Sequelize.Op.gte]: minAnomalyScore
            }
        };

        if (source) whereClause.source = source;
        if (service) whereClause.service = service;
        if (userId) whereClause.userId = userId;
        
        if (startTime && endTime) {
            whereClause.timestamp = {
                [sequelize.Sequelize.Op.between]: [startTime, endTime]
            };
        }

        return await this.findAll({
            where: whereClause,
            order: [['anomalyScore', 'DESC'], ['timestamp', 'DESC']],
            limit: 50
        });
    };

    MetricsHistory.getResourceHealth = async function(filters = {}) {
        const { source, service, userId } = filters;
        
        const whereClause = {};
        if (source) whereClause.source = source;
        if (service) whereClause.service = service;
        if (userId) whereClause.userId = userId;

        // Get the latest metrics for each resource
        const latestMetrics = await this.findAll({
            where: {
                ...whereClause,
                timestamp: {
                    [sequelize.Sequelize.Op.gte]: new Date(Date.now() - 30 * 60 * 1000) // Last 30 minutes
                }
            },
            attributes: [
                'resourceId',
                'resourceName',
                'service',
                'region',
                [sequelize.Sequelize.fn('AVG', sequelize.Sequelize.col('metricValue')), 'avgValue'],
                [sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.col('id')), 'dataPoints'],
                [sequelize.Sequelize.fn('SUM', sequelize.Sequelize.literal('CASE WHEN isAnomaly THEN 1 ELSE 0 END')), 'anomalyCount']
            ],
            group: ['resourceId', 'resourceName', 'service', 'region'],
            order: [[sequelize.Sequelize.fn('AVG', sequelize.Sequelize.col('metricValue')), 'DESC']]
        });

        return latestMetrics;
    };

    MetricsHistory.getTrendAnalysis = async function(filters = {}) {
        const {
            source,
            service,
            metricName,
            resourceId,
            days = 7,
            userId
        } = filters;

        const startTime = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        
        const whereClause = {
            timestamp: {
                [sequelize.Sequelize.Op.gte]: startTime
            }
        };

        if (source) whereClause.source = source;
        if (service) whereClause.service = service;
        if (metricName) whereClause.metricName = metricName;
        if (resourceId) whereClause.resourceId = resourceId;
        if (userId) whereClause.userId = userId;

        return await this.findAll({
            where: whereClause,
            attributes: [
                [sequelize.Sequelize.fn('DATE_TRUNC', 'hour', sequelize.Sequelize.col('timestamp')), 'hour'],
                [sequelize.Sequelize.fn('AVG', sequelize.Sequelize.col('metricValue')), 'avgValue'],
                [sequelize.Sequelize.fn('MIN', sequelize.Sequelize.col('metricValue')), 'minValue'],
                [sequelize.Sequelize.fn('MAX', sequelize.Sequelize.col('metricValue')), 'maxValue'],
                [sequelize.Sequelize.fn('COUNT', sequelize.Sequelize.col('id')), 'dataPoints']
            ],
            group: [sequelize.Sequelize.fn('DATE_TRUNC', 'hour', sequelize.Sequelize.col('timestamp'))],
            order: [[sequelize.Sequelize.fn('DATE_TRUNC', 'hour', sequelize.Sequelize.col('timestamp')), 'ASC']]
        });
    };

    return MetricsHistory;
};