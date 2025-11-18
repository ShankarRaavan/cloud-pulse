const express = require('express');
const router = express.Router();
const axios = require('axios');
const db = require('../models');

// Real AWS metric endpoints for dashboard visualization
router.get('/aws/metrics/:monitorId/data', async (req, res) => {
    try {
        const { monitorId } = req.params;
        const { timeRange = '1h' } = req.query;
        
        console.log(`📊 Getting REAL metric data for monitor ${monitorId}`);
        
        // Get monitor details
        const monitor = await db.Monitor.findByPk(monitorId);
        if (!monitor) {
            return res.status(404).json({ error: 'Monitor not found' });
        }
        
        // Get AWS credentials
        const awsCredential = await db.AwsCredential.findOne();
        if (!awsCredential) {
            return res.status(400).json({ error: 'AWS credentials not configured' });
        }
        
        // Call real AWS CloudWatch API
        const response = await axios.get('http://aws-service-js:8000/api/cloudwatch/metric-data', {
            params: {
                namespace: monitor.metricNamespace,
                metricName: monitor.metricName,
                resourceId: monitor.resourceId,
                period: 300,
                statistic: 'Average'
            },
            headers: {
                'x-aws-access-key-id': awsCredential.aws_access_key_id,
                'x-aws-secret-access-key': awsCredential.aws_secret_access_key,
                'x-aws-region': awsCredential.region || 'us-east-1'
            }
        });
        
        if (response.data && response.data.dataPoints) {
            res.json({
                success: true,
                monitor: {
                    id: monitor.id,
                    name: monitor.name,
                    metricName: monitor.metricName,
                    namespace: monitor.metricNamespace,
                    resourceId: monitor.resourceId
                },
                data: response.data.dataPoints.map(point => ({
                    timestamp: point.timestamp,
                    value: point.value,
                    unit: point.unit || 'Count'
                })),
                source: 'real-aws-cloudwatch'
            });
        } else {
            res.status(500).json({ 
                error: 'No metric data available from CloudWatch',
                source: 'no-data'
            });
        }
        
    } catch (error) {
        console.error('❌ Failed to get real AWS metric data:', error);
        res.status(500).json({ 
            error: 'Failed to fetch real AWS metric data',
            details: error.message,
            source: 'api-error'
        });
    }
});

// Real AWS resource list for dashboard
router.get('/aws/resources', async (req, res) => {
    try {
        console.log('🔍 Getting REAL AWS resources...');
        
        // Get AWS credentials
        const awsCredential = await db.AwsCredential.findOne();
        if (!awsCredential) {
            return res.status(400).json({ error: 'AWS credentials not configured' });
        }
        
        // Get real EC2 instances
        const ec2Response = await axios.get('http://aws-service-js:8000/api/ec2/instances', {
            headers: {
                'x-aws-access-key-id': awsCredential.aws_access_key_id,
                'x-aws-secret-access-key': awsCredential.aws_secret_access_key,
                'x-aws-region': awsCredential.region || 'us-east-1'
            }
        });
        
        res.json({
            success: true,
            resources: {
                ec2: ec2Response.data || [],
                // Add other resource types as needed
            },
            source: 'real-aws-api'
        });
        
    } catch (error) {
        console.error('❌ Failed to get real AWS resources:', error);
        res.status(500).json({ 
            error: 'Failed to fetch AWS resources',
            details: error.message 
        });
    }
});

module.exports = router;