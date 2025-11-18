const db = require('../models');
const Monitor = db.Monitor;
const History = db.History;
const Notification = db.Notification;
const { refreshTokenForMonitor } = require('../services/tokenRefreshService');

exports.getAllMonitors = async (req, res) => {
    try {
        const { type } = req.query;
        
        let whereClause = {};
        if (type) {
            if (type === 'aws') {
                whereClause.monitorType = 'aws';
            } else if (type === 'http' || type === 'synthetic') {
                whereClause.monitorType = { [db.Sequelize.Op.or]: [null, 'http', 'synthetic'] };
            }
        }
        
        const monitors = await Monitor.findAll({
            where: whereClause,
            attributes: [
                'id', 'name', 'url', 'method', 'requestBody', 'customHeaders',
                'authType', 'authUsername', 'authPassword', 'bearerToken', 'credentialId',
                'monitoringInterval', 'region', 'retryCount', 'requestTimeout', 'alertThreshold',
                'monitorType', 'resourceType', 'resourceId',
                'resourceIds', 'resourceNames', 'metricName', 'metricNamespace', 
                'thresholdValue', 'thresholdOperator', 'isEnabled', 'createdAt', 'updatedAt'
            ],
            include: [
                {
                    model: History,
                    as: 'historyRecords',
                    limit: 1,
                    order: [['createdAt', 'DESC']]
                },
                {
                    model: Notification,
                    through: { attributes: [] } // Don't include the join table attributes
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        // Optimize: Fetch all error counts in a single query
        const errorCountsQuery = await History.findAll({
            where: {
                monitorId: {
                    [db.Sequelize.Op.in]: monitors.map(m => m.id)
                },
                statusCode: {
                    [db.Sequelize.Op.gte]: 400
                }
            },
            attributes: [
                'monitorId',
                [db.sequelize.fn('SUM', db.sequelize.literal('CASE WHEN statusCode >= 400 AND statusCode < 500 THEN 1 ELSE 0 END')), '4XX'],
                [db.sequelize.fn('SUM', db.sequelize.literal('CASE WHEN statusCode >= 500 THEN 1 ELSE 0 END')), '5XX']
            ],
            group: ['monitorId'],
            raw: true
        });

        // Create a map for quick lookup
        const errorCountsMap = {};
        errorCountsQuery.forEach(row => {
            errorCountsMap[row.monitorId] = {
                '4XX': parseInt(row['4XX'] || 0, 10),
                '5XX': parseInt(row['5XX'] || 0, 10)
            };
        });

        // Attach error counts to monitors
        const monitorsWithCounts = monitors.map(monitor => ({
            ...monitor.toJSON(),
            errorCounts: errorCountsMap[monitor.id] || { '4XX': 0, '5XX': 0 }
        }));

        res.json(monitorsWithCounts);
    } catch (error) {
        console.error('Error fetching monitors:', error);
        res.status(500).json({ error: 'Failed to fetch monitors' });
    }
};

exports.getMonitorById = async (req, res) => {
    try {
        const monitor = await Monitor.findByPk(req.params.id, {
            attributes: [
                'id', 'name', 'url', 'method', 'requestBody', 'customHeaders',
                'authType', 'authUsername', 'authPassword', 'bearerToken', 'credentialId',
                'monitoringInterval', 'region', 'retryCount', 'requestTimeout', 'alertThreshold',
                'monitorType', 'resourceType', 'resourceId',
                'resourceIds', 'resourceNames', 'metricName', 'metricNamespace', 
                'thresholdValue', 'thresholdOperator', 'isEnabled', 'createdAt', 'updatedAt'
            ]
        });
        
        if (!monitor) {
            return res.status(404).json({ error: 'Monitor not found' });
        }
        
        res.json(monitor);
    } catch (error) {
        console.error('Error fetching monitor:', error);
        res.status(500).json({ error: 'Failed to fetch monitor' });
    }
};

exports.getMonitorHistory = async (req, res) => {
    const { start, end } = req.query;
    let whereClause = { monitorId: req.params.id };

    if (start && end) {
        whereClause.createdAt = {
            [db.Sequelize.Op.between]: [new Date(start), new Date(end)]
        };
    }

    const history = await History.findAll({
        where: whereClause,
        order: [['createdAt', 'ASC']]
    });
    console.log('whereClause:', whereClause);
    console.log('history:', history);
    res.json(history);
};

exports.createMonitor = async (req, res) => {
    try {
        console.log('📝 Creating monitor with data:', req.body);
        
        const { notificationIds, metrics, resourceIds, resourceNames, ...monitorData } = req.body;
        
        // Handle AWS monitors - NEW MULTI-RESOURCE APPROACH
        if (monitorData.monitorType === 'aws' && resourceIds && Array.isArray(resourceIds)) {
            // Create ONE monitor for multiple resources (Datadog-style)
            console.log(`🎯 Creating single AWS monitor for ${resourceIds.length} resources`);
            
            const awsMonitorData = {
                name: monitorData.name,
                url: `aws://${monitorData.resourceType}/${resourceIds.join(',')}`,
                method: 'AWS',
                monitorType: 'aws',
                resourceType: monitorData.resourceType,
                resourceIds: JSON.stringify(resourceIds), // Store as JSON array
                resourceNames: resourceNames ? JSON.stringify(resourceNames) : null,
                metricName: monitorData.metricName,
                metricNamespace: monitorData.metricNamespace,
                thresholdOperator: monitorData.thresholdOperator || '>',
                thresholdValue: monitorData.thresholdValue,
                monitoringInterval: monitorData.monitoringInterval || 300,
                isEnabled: true
            };
            
            console.log('🔧 Creating multi-resource AWS monitor:', awsMonitorData);
            const monitor = await Monitor.create(awsMonitorData);
            
            console.log(`✅ Created monitor ${monitor.id} for ${resourceIds.length} resources`);
            res.status(201).json(monitor);
            
        } else if (monitorData.type === 'aws') {
            // OLD APPROACH: For backwards compatibility with old AWS monitor creation
            const createdMonitors = [];
            
            if (metrics && metrics.length > 0) {
                for (const metric of metrics) {
                    const awsMonitorData = {
                        name: `${monitorData.name} - ${metric}`,
                        url: `aws://${monitorData.service}/${metric}`,
                        method: 'AWS',
                        monitorType: 'aws',
                        resourceType: monitorData.service,
                        resourceId: monitorData.resourceId || 'all',
                        metricName: metric,
                        metricNamespace: monitorData.service,
                        region: monitorData.region || 'us-east-1',
                        monitoringInterval: monitorData.collectionInterval || 300,
                        thresholdValue: monitorData.alertThreshold || 0.8,
                        thresholdOperator: '>=',
                        isEnabled: true
                    };
                    
                    console.log('🔧 Creating AWS monitor:', awsMonitorData);
                    const monitor = await Monitor.create(awsMonitorData);
                    createdMonitors.push(monitor);
                }
                
                console.log(`✅ Created ${createdMonitors.length} AWS monitors`);
                res.status(201).json({ 
                    message: `Created ${createdMonitors.length} AWS monitors successfully`,
                    monitors: createdMonitors 
                });
            } else {
                throw new Error('No metrics specified for AWS monitor');
            }
        } else {
            // Handle regular HTTP monitors
            const monitor = await Monitor.create(monitorData);
            if (notificationIds && notificationIds.length > 0) {
                await monitor.setNotifications(notificationIds);
            }
            if (monitor.credentialId) {
                await refreshTokenForMonitor(monitor);
            }
            res.status(201).json(monitor);
        }
    } catch (error) {
        console.error('❌ Monitor creation error:', error);
        res.status(400).json({ message: 'Invalid data provided for monitor', details: error.message });
    }
};

exports.updateMonitor = async (req, res) => {
    try {
        const { notificationIds, ...monitorData } = req.body;
        const monitor = await Monitor.findByPk(req.params.id);
        if (monitor) {
            await monitor.update(monitorData);
            if (notificationIds) {
                await monitor.setNotifications(notificationIds);
            }
            if (monitor.credentialId) {
                await refreshTokenForMonitor(monitor);
            }
            res.json(monitor);
        } else {
            res.status(404).json({ message: 'Monitor not found' });
        }
    } catch (error) {
        res.status(400).json({ message: 'Invalid data provided for monitor', details: error.message });
    }
};

exports.deleteMonitor = async (req, res) => {
    try {
        const monitor = await Monitor.findByPk(req.params.id);
        if (!monitor) {
            return res.status(404).json({ message: 'Monitor not found' });
        }

        // Delete related records first to avoid foreign key constraint errors
        const { History, Notification } = require('../models');
        
        // Delete history records
        await History.destroy({ where: { monitorId: req.params.id } });
        
        // Remove notification associations (many-to-many)
        await monitor.setNotifications([]);
        
        // Now delete the monitor
        await monitor.destroy();
        
        res.sendStatus(204);
    } catch (error) {
        console.error('Error deleting monitor:', error);
        res.status(500).json({ message: 'Failed to delete monitor', details: error.message });
    }
};

exports.refreshTokenForCredential = async (req, res) => {
    try {
        const { credentialId } = req.body;
        if (!credentialId) {
            return res.status(400).json({ message: 'Credential ID is required' });
        }

        // Create a temporary, in-memory monitor object to pass to the refresh service
        const tempMonitor = {
            credentialId: credentialId,
            name: 'on-demand-refresh',
            update: (data) => { // Mock the update function
                return Promise.resolve(data);
            }
        };

        const refreshedData = await refreshTokenForMonitor(tempMonitor);

        if (refreshedData && refreshedData.bearerToken) {
            res.json({ bearerToken: refreshedData.bearerToken });
        } else {
            throw new Error('Token refresh did not return a bearer token.');
        }
    } catch (error) {
        console.error('❌ On-demand token refresh error:', error);
        res.status(500).json({ message: 'Failed to refresh token', details: error.message });
    }
};

// Get timeseries data for multi-resource monitor
exports.getMonitorTimeseries = async (req, res) => {
    try {
        const { id } = req.params;
        const { range = '1h', aggregate = 'none' } = req.query;
        
        console.log(`📊 Fetching REAL timeseries for monitor ${id}, range: ${range}, aggregate: ${aggregate}`);
        
        const monitor = await Monitor.findByPk(id);
        if (!monitor) {
            return res.status(404).json({ error: 'Monitor not found' });
        }
        
        // Parse resourceIds from JSON
        let resourceIds = [];
        let resourceNames = [];
        
        if (monitor.resourceIds) {
            try {
                resourceIds = JSON.parse(monitor.resourceIds);
                resourceNames = monitor.resourceNames ? JSON.parse(monitor.resourceNames) : resourceIds;
            } catch (e) {
                console.error('Failed to parse resourceIds:', e);
                resourceIds = [monitor.resourceId]; // Fallback to single resource
                resourceNames = [monitor.resourceId];
            }
        } else if (monitor.resourceId) {
            resourceIds = [monitor.resourceId];
            resourceNames = [monitor.resourceId];
        }
        
        console.log(`📈 Fetching REAL CloudWatch data for ${resourceIds.length} resources:`, resourceIds);
        
        // Fetch real AWS credentials
        const AwsCredential = db.AwsCredential;
        const awsCredentials = await AwsCredential.findOne();
        
        if (!awsCredentials) {
            return res.status(400).json({ error: 'AWS credentials not configured' });
        }
        
        // Call AWS service to get real CloudWatch metrics for each resource
        const axios = require('axios');
        
        // Fix region: if monitor region is "Default" or empty, use AWS credentials default region
        const effectiveRegion = (monitor.region && monitor.region !== 'Default') 
            ? monitor.region 
            : (awsCredentials.aws_default_region || 'us-east-1');
        
        console.log(`🌍 Using region: ${effectiveRegion} (monitor region: ${monitor.region})`);
        
        const seriesPromises = resourceIds.map(async (resourceId, index) => {
            try {
                // Call the real CloudWatch API endpoint
                const url = `http://aws-service-js:8000/api/cloudwatch/metric-data?namespace=${monitor.metricNamespace}&metricName=${monitor.metricName}&resourceId=${resourceId}&period=300&statistic=Average&range=${range}`;
                
                console.log(`🔍 Fetching CloudWatch data for ${resourceId}:`, url);
                
                const response = await axios.get(url, {
                    headers: {
                        'x-aws-access-key-id': awsCredentials.aws_access_key_id,
                        'x-aws-secret-access-key': awsCredentials.aws_secret_access_key,
                        'x-aws-region': effectiveRegion
                    },
                    timeout: 10000 // 10 second timeout
                });
                
                console.log(`✅ Got ${response.data.dataPoints?.length || 0} data points for ${resourceId}`);
                
                // Transform CloudWatch response to our format
                const dataPoints = response.data.dataPoints || [];
                const transformedData = dataPoints.map(dp => ({
                    timestamp: dp.timestamp,
                    value: dp.value
                }));
                
                return {
                    resourceId,
                    resourceName: resourceNames[index] || resourceId,
                    data: transformedData,
                    color: getColorForResource(resourceId)
                };
            } catch (error) {
                console.error(`❌ Failed to fetch CloudWatch data for ${resourceId}:`, error.message);
                // Return empty data for failed resource
                return {
                    resourceId,
                    resourceName: resourceNames[index] || resourceId,
                    data: [],
                    color: getColorForResource(resourceId),
                    error: error.message
                };
            }
        });
        
        const series = await Promise.all(seriesPromises);
        
        // Log summary of data fetched
        series.forEach(s => {
            if (s.data.length > 0) {
                console.log(`✅ ${s.resourceId}: ${s.data.length} data points`);
            } else if (s.error) {
                console.log(`❌ ${s.resourceId}: ${s.error}`);
            } else {
                console.log(`⚠️  ${s.resourceId}: No data points (CloudWatch returned empty)`);
            }
        });
        
        const timeSeriesData = {
            monitorId: id,
            monitorName: monitor.name,
            metricName: monitor.metricName,
            resourceType: monitor.resourceType,
            range,
            series: series.filter(s => s.data.length > 0), // Filter out empty series
            seriesWithErrors: series.filter(s => s.error || s.data.length === 0) // Include errors for debugging
        };
        
        // Add aggregates if requested and we have data
        if (aggregate !== 'none' && timeSeriesData.series.length > 0) {
            timeSeriesData.aggregates = calculateAggregates(timeSeriesData.series, aggregate);
        }
        
        console.log(`✅ Returning timeseries data with ${timeSeriesData.series.length} series`);
        res.json(timeSeriesData);
    } catch (error) {
        console.error('❌ Error fetching timeseries:', error);
        res.status(500).json({ error: 'Failed to fetch timeseries data', details: error.message });
    }
};

// Helper functions for timeseries
function generateMockTimeseriesData(range) {
    const points = getRangePoints(range);
    const now = Date.now();
    const interval = getRangeInterval(range);
    
    return Array.from({ length: points }, (_, i) => ({
        timestamp: now - (points - i - 1) * interval,
        value: Math.random() * 100
    }));
}

function getRangePoints(range) {
    const ranges = { '15m': 15, '1h': 60, '6h': 72, '24h': 96, '7d': 168 };
    return ranges[range] || 60;
}

function getRangeInterval(range) {
    const intervals = { '15m': 60000, '1h': 60000, '6h': 300000, '24h': 900000, '7d': 3600000 };
    return intervals[range] || 60000;
}

function getColorForResource(resourceId) {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    const hash = resourceId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
}

function calculateAggregates(series, type) {
    // Calculate average, max, or p95 across all series
    const timestamps = series[0].data.map(d => d.timestamp);
    
    return timestamps.map(timestamp => {
        const values = series.map(s => s.data.find(d => d.timestamp === timestamp)?.value || 0);
        let value;
        
        switch (type) {
            case 'avg':
                value = values.reduce((a, b) => a + b, 0) / values.length;
                break;
            case 'max':
                value = Math.max(...values);
                break;
            case 'p95':
                const sorted = [...values].sort((a, b) => a - b);
                value = sorted[Math.floor(sorted.length * 0.95)];
                break;
            default:
                value = 0;
        }
        
        return { timestamp, value };
    });
}

exports.createMonitorFromAI = async (req, res) => {
    try {
        console.log('🤖 AI Agent creating monitor:', req.body);
        
        const config = req.body;
        const monitorType = config.monitorType || config.type || 'synthetic';
        
        // Base monitor data
        const monitorData = {
            name: config.name || 'AI Generated Monitor',
            monitorType: monitorType,
            monitoringInterval: config.monitoringInterval || config.check_interval || 300,
            isEnabled: config.isEnabled !== undefined ? config.isEnabled : true
        };
        
        // Handle AWS CloudWatch monitors
        if (monitorType === 'aws') {
            Object.assign(monitorData, {
                url: 'aws://cloudwatch', // Dummy URL for AWS monitors
                resourceType: config.resourceType,
                resourceIds: config.resourceIds || JSON.stringify([]),
                resourceNames: config.resourceNames || JSON.stringify([]),
                metricName: config.metricName,
                metricNamespace: config.metricNamespace,
                thresholdOperator: config.thresholdOperator || '>',
                thresholdValue: config.thresholdValue,
                region: config.region || 'us-east-1',
                // Optional
                metricDimensions: config.metricDimensions ? JSON.stringify(config.metricDimensions) : null
            });
        } 
        // Handle Synthetic/URL monitors
        else {
            Object.assign(monitorData, {
                url: config.url,
                method: config.method || 'GET',
                requestTimeout: config.requestTimeout || config.timeout || 30,
                alertThreshold: config.alertThreshold || config.alert_threshold || 1,
                retryCount: config.retryCount || 0,
                // Optional fields
                authType: config.authType || 'NONE',
                authUsername: config.authUsername || null,
                authPassword: config.authPassword || null,
                bearerToken: config.bearerToken || null,
                requestBody: config.requestBody || config.request_body || null,
                customHeaders: config.customHeaders || (config.headers ? JSON.stringify(config.headers) : null)
            });
        }
        
        console.log('📝 Mapped monitor data:', monitorData);
        
        const monitor = await Monitor.create(monitorData);
        
        console.log('✅ Monitor created successfully:', monitor.id);
        
        // Handle notifications if provided
        if (config.notifications && Array.isArray(config.notifications)) {
            for (const notif of config.notifications) {
                const notification = await Notification.create({
                    type: notif.type,
                    config: notif.config,
                    isEnabled: notif.isEnabled !== undefined ? notif.isEnabled : true
                });
                await monitor.addNotification(notification);
                console.log(`✅ Added ${notif.type} notification`);
            }
        }
        
        res.status(201).json({
            success: true,
            monitorId: monitor.id,
            message: 'Monitor created successfully',
            monitor: monitor
        });
        
    } catch (error) {
        console.error('❌ Error creating monitor from AI:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to create monitor',
            details: error.message 
        });
    }
};
