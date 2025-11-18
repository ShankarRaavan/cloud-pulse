const db = require('../models');
const { MetricsHistory } = db;
const { Op } = require('sequelize');

class MetricsHistoryController {
    // Store metrics data
    async storeMetrics(req, res) {
        try {
            const metricsData = Array.isArray(req.body) ? req.body : [req.body];
            
            // Validate required fields
            for (const metric of metricsData) {
                if (!metric.source || !metric.service || !metric.resourceId || 
                    !metric.metricName || metric.metricValue === undefined || !metric.timestamp) {
                    return res.status(400).json({
                        error: 'Missing required fields: source, service, resourceId, metricName, metricValue, timestamp'
                    });
                }
            }

            // Bulk insert metrics
            const createdMetrics = await MetricsHistory.bulkCreate(metricsData, {
                validate: true,
                returning: true
            });

            res.status(201).json({
                message: 'Metrics stored successfully',
                count: createdMetrics.length,
                metrics: createdMetrics
            });

        } catch (error) {
            console.error('Error storing metrics:', error);
            res.status(500).json({
                error: 'Failed to store metrics',
                details: error.message
            });
        }
    }

    // Get metrics summary
    async getMetricsSummary(req, res) {
        try {
            const {
                source,
                service,
                resourceId,
                metricName,
                startTime,
                endTime,
                limit = 1000
            } = req.query;

            const userId = req.user?.id; // Assuming user authentication middleware

            const filters = {
                source,
                service,
                resourceId,
                metricName,
                startTime: startTime ? new Date(startTime) : undefined,
                endTime: endTime ? new Date(endTime) : undefined,
                userId
            };

            const metrics = await MetricsHistory.getMetricsSummary(filters);

            // Limit results to prevent overwhelming response
            const limitedMetrics = metrics.slice(0, parseInt(limit));

            res.json({
                metrics: limitedMetrics,
                totalCount: metrics.length,
                filters: {
                    ...filters,
                    startTime: filters.startTime?.toISOString(),
                    endTime: filters.endTime?.toISOString()
                }
            });

        } catch (error) {
            console.error('Error fetching metrics summary:', error);
            res.status(500).json({
                error: 'Failed to fetch metrics summary',
                details: error.message
            });
        }
    }

    // Get anomalies
    async getAnomalies(req, res) {
        try {
            const {
                source,
                service,
                startTime,
                endTime,
                minAnomalyScore = 0.7
            } = req.query;

            const userId = req.user?.id;

            const filters = {
                source,
                service,
                startTime: startTime ? new Date(startTime) : undefined,
                endTime: endTime ? new Date(endTime) : undefined,
                userId,
                minAnomalyScore: parseFloat(minAnomalyScore)
            };

            const anomalies = await MetricsHistory.getAnomalies(filters);

            res.json({
                anomalies,
                count: anomalies.length,
                filters: {
                    ...filters,
                    startTime: filters.startTime?.toISOString(),
                    endTime: filters.endTime?.toISOString()
                }
            });

        } catch (error) {
            console.error('Error fetching anomalies:', error);
            res.status(500).json({
                error: 'Failed to fetch anomalies',
                details: error.message
            });
        }
    }

    // Get resource health
    async getResourceHealth(req, res) {
        try {
            const { source, service } = req.query;
            const userId = req.user?.id;

            const filters = { source, service, userId };
            const healthData = await MetricsHistory.getResourceHealth(filters);

            // Process health data to determine status
            const processedHealth = healthData.map(resource => {
                const avgValue = parseFloat(resource.dataValues.avgValue || 0);
                const anomalyCount = parseInt(resource.dataValues.anomalyCount || 0);
                const dataPoints = parseInt(resource.dataValues.dataPoints || 0);
                
                let status = 'healthy';
                if (anomalyCount > 0) {
                    status = 'warning';
                }
                if (anomalyCount > dataPoints * 0.3) { // More than 30% anomalies
                    status = 'critical';
                }

                return {
                    resourceId: resource.resourceId,
                    resourceName: resource.resourceName,
                    service: resource.service,
                    region: resource.region,
                    avgValue,
                    anomalyCount,
                    dataPoints,
                    status
                };
            });

            res.json({
                resources: processedHealth,
                count: processedHealth.length,
                filters
            });

        } catch (error) {
            console.error('Error fetching resource health:', error);
            res.status(500).json({
                error: 'Failed to fetch resource health',
                details: error.message
            });
        }
    }

    // Get trend analysis
    async getTrendAnalysis(req, res) {
        try {
            const {
                source,
                service,
                metricName,
                resourceId,
                days = 7
            } = req.query;

            const userId = req.user?.id;

            const filters = {
                source,
                service,
                metricName,
                resourceId,
                days: parseInt(days),
                userId
            };

            const trends = await MetricsHistory.getTrendAnalysis(filters);

            // Calculate percentage changes
            const processedTrends = trends.map((trend, index) => {
                const current = parseFloat(trend.dataValues.avgValue || 0);
                let percentChange = 0;
                
                if (index > 0) {
                    const previous = parseFloat(trends[index - 1].dataValues.avgValue || 0);
                    if (previous > 0) {
                        percentChange = ((current - previous) / previous) * 100;
                    }
                }

                return {
                    hour: trend.dataValues.hour,
                    avgValue: current,
                    minValue: parseFloat(trend.dataValues.minValue || 0),
                    maxValue: parseFloat(trend.dataValues.maxValue || 0),
                    dataPoints: parseInt(trend.dataValues.dataPoints || 0),
                    percentChange: Math.round(percentChange * 100) / 100
                };
            });

            res.json({
                trends: processedTrends,
                count: processedTrends.length,
                filters
            });

        } catch (error) {
            console.error('Error fetching trend analysis:', error);
            res.status(500).json({
                error: 'Failed to fetch trend analysis',
                details: error.message
            });
        }
    }

    // Delete old metrics (cleanup)
    async cleanupMetrics(req, res) {
        try {
            const { daysToKeep = 90 } = req.query;
            const cutoffDate = new Date(Date.now() - parseInt(daysToKeep) * 24 * 60 * 60 * 1000);

            const deletedCount = await MetricsHistory.destroy({
                where: {
                    collectedAt: {
                        [Op.lt]: cutoffDate
                    }
                }
            });

            res.json({
                message: 'Metrics cleanup completed',
                deletedCount,
                cutoffDate: cutoffDate.toISOString()
            });

        } catch (error) {
            console.error('Error cleaning up metrics:', error);
            res.status(500).json({
                error: 'Failed to cleanup metrics',
                details: error.message
            });
        }
    }

    // Get metrics statistics
    async getStatistics(req, res) {
        try {
            const userId = req.user?.id;
            const whereClause = userId ? { userId } : {};

            // Get overall statistics
            const totalMetrics = await MetricsHistory.count({ where: whereClause });
            
            const anomaliesCount = await MetricsHistory.count({
                where: { ...whereClause, isAnomaly: true }
            });

            const serviceStats = await MetricsHistory.findAll({
                where: whereClause,
                attributes: [
                    'service',
                    [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
                ],
                group: ['service'],
                order: [[db.sequelize.fn('COUNT', db.sequelize.col('id')), 'DESC']]
            });

            const sourceStats = await MetricsHistory.findAll({
                where: whereClause,
                attributes: [
                    'source',
                    [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
                ],
                group: ['source'],
                order: [[db.sequelize.fn('COUNT', db.sequelize.col('id')), 'DESC']]
            });

            // Get recent metrics count (last 24 hours)
            const recentMetrics = await MetricsHistory.count({
                where: {
                    ...whereClause,
                    collectedAt: {
                        [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000)
                    }
                }
            });

            res.json({
                statistics: {
                    totalMetrics,
                    anomaliesCount,
                    recentMetrics,
                    anomalyRate: totalMetrics > 0 ? (anomaliesCount / totalMetrics * 100).toFixed(2) : 0,
                    serviceDistribution: serviceStats.map(stat => ({
                        service: stat.service,
                        count: parseInt(stat.dataValues.count)
                    })),
                    sourceDistribution: sourceStats.map(stat => ({
                        source: stat.source,
                        count: parseInt(stat.dataValues.count)
                    }))
                }
            });

        } catch (error) {
            console.error('Error fetching statistics:', error);
            res.status(500).json({
                error: 'Failed to fetch statistics',
                details: error.message
            });
        }
    }
}

module.exports = new MetricsHistoryController();