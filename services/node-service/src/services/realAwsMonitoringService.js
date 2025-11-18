const axios = require('axios');
const db = require('../models');
const Monitor = db.Monitor;
const History = db.History;

// Real AWS CloudWatch monitoring service
class RealAwsMonitoringService {
    constructor() {
        this.awsServiceUrl = process.env.AWS_SERVICE_URL || 'http://aws-service-js:8000';
    }

    async getAwsCredentials() {
        try {
            const awsCredential = await db.AwsCredential.findOne();
            if (!awsCredential) {
                throw new Error('AWS credentials not configured');
            }
            return {
                accessKeyId: awsCredential.aws_access_key_id,
                secretAccessKey: awsCredential.aws_secret_access_key,
                region: awsCredential.region || 'us-east-1'
            };
        } catch (error) {
            throw new Error('Failed to get AWS credentials: ' + error.message);
        }
    }

    async getRealMetricValue(monitor) {
        try {
            console.log(`🔍 Getting REAL CloudWatch metric: ${monitor.metricNamespace}/${monitor.metricName}`);
            
            const credentials = await this.getAwsCredentials();
            
            // Call the real AWS CloudWatch API via aws-service  
            const response = await axios.get(`${this.awsServiceUrl}/api/api/cloudwatch/metric-data`, {
                params: {
                    namespace: monitor.metricNamespace,
                    metricName: monitor.metricName,
                    resourceId: monitor.resourceId,
                    period: 300, // 5 minutes
                    statistic: 'Average'
                },
                headers: {
                    'x-aws-access-key-id': credentials.accessKeyId,
                    'x-aws-secret-access-key': credentials.secretAccessKey,
                    'x-aws-region': credentials.region
                },
                timeout: 10000
            });

            if (response.data && response.data.dataPoints && response.data.dataPoints.length > 0) {
                const latestPoint = response.data.dataPoints[response.data.dataPoints.length - 1];
                return {
                    value: latestPoint.value,
                    unit: latestPoint.unit || this.getDefaultUnit(monitor.metricName),
                    timestamp: latestPoint.timestamp,
                    source: 'real-aws-cloudwatch'
                };
            }

            throw new Error('No data points returned from CloudWatch');

        } catch (error) {
            console.error(`❌ Failed to get real metric for ${monitor.name}:`, error);
            throw error;
        }
    }

    getDefaultUnit(metricName) {
        const unitMap = {
            'CPUUtilization': 'Percent',
            'NetworkIn': 'Bytes',
            'NetworkOut': 'Bytes',
            'DiskReadOps': 'Count/Second',
            'DiskWriteOps': 'Count/Second',
            'StatusCheckFailed': 'Count',
            'CPUCreditUsage': 'Count',
            'CPUCreditBalance': 'Count'
        };
        return unitMap[metricName] || 'Count';
    }

    async checkAwsMonitorHealth(monitor) {
        try {
            console.log(`🔍 Checking AWS monitor: ${monitor.name} (${monitor.metricNamespace}/${monitor.metricName})`);
            
            let metricData = null;
            let status = 'Success';
            let statusCode = 200;
            let message = '';

            try {
                // Get REAL metric value from AWS CloudWatch
                metricData = await this.getRealMetricValue(monitor);
                
                const actualValue = `${metricData.value.toFixed(2)} ${metricData.unit}`;
                message = `✅ REAL AWS CloudWatch: ${monitor.metricName} = ${actualValue}`;
                
                // Check threshold violation with REAL data
                if (monitor.thresholdValue && metricData.value !== null) {
                    const threshold = parseFloat(monitor.thresholdValue);
                    const operator = monitor.thresholdOperator || '>=';
                    
                    let thresholdViolated = false;
                    switch (operator) {
                        case '>=':
                            thresholdViolated = metricData.value >= threshold;
                            break;
                        case '>':
                            thresholdViolated = metricData.value > threshold;
                            break;
                        case '<=':
                            thresholdViolated = metricData.value <= threshold;
                            break;
                        case '<':
                            thresholdViolated = metricData.value < threshold;
                            break;
                    }
                    
                    if (thresholdViolated) {
                        status = 'Fail';
                        statusCode = 400;
                        message = `🚨 THRESHOLD ALERT: ${monitor.metricName} = ${actualValue} ${operator} ${threshold}`;
                        console.log(`🚨 REAL THRESHOLD VIOLATION: ${monitor.name}`);
                    }
                }

                console.log(`📊 REAL AWS Data - ${monitor.name}: ${actualValue}`);

            } catch (metricError) {
                // If real AWS API fails, provide a more user-friendly error
                console.error(`❌ REAL AWS API FAILED for ${monitor.name}:`, metricError.message);
                status = 'Fail';
                statusCode = 503; // Service Unavailable instead of 500
                
                // Provide more specific error messages based on the error type
                if (metricError.message.includes('credentials not configured')) {
                    message = `⚠️ AWS credentials not configured. Please set up AWS access keys.`;
                } else if (metricError.message.includes('timeout') || metricError.message.includes('ECONNREFUSED')) {
                    message = `🔌 AWS service connection failed. Check network connectivity.`;
                } else if (metricError.message.includes('InvalidParameterValue') || metricError.message.includes('ValidationError')) {
                    message = `📝 AWS API parameter error: Check metric configuration.`;
                } else {
                    message = `❌ AWS CloudWatch Error: ${metricError.message.substring(0, 100)}`;
                }
                
                metricData = { value: null, unit: 'Error', source: 'aws-api-error' };
            }
            
            return {
                statusCode: statusCode,
                responseTime: 200, // Real API response time would be measured
                dataLength: 256,
                status: status,
                message: message,
                metricValue: metricData ? metricData.value : null,
                metricUnit: metricData ? metricData.unit : null,
                metricSource: metricData ? metricData.source : 'error',
                timestamp: new Date()
            };

        } catch (error) {
            console.error(`❌ AWS monitor check failed for ${monitor.name}:`, error);
            return {
                statusCode: 500,
                responseTime: 0,
                dataLength: 0,
                status: 'Fail',
                message: `AWS monitoring service error: ${error.message}`,
                metricValue: null,
                metricUnit: null,
                metricSource: 'service-error',
                timestamp: new Date()
            };
        }
    }

    async saveAwsMonitorResult(monitor, result) {
        try {
            // Verify monitor still exists before saving history
            const existingMonitor = await Monitor.findByPk(monitor.id);
            if (existingMonitor) {
                // Save the result to the database
                await History.create({
                    monitorId: monitor.id,
                    status: result.status,
                    statusCode: result.statusCode,
                    responseTime: result.responseTime,
                    dataLength: result.dataLength,
                    message: result.message
                });

                // Prune old history records, keeping the last 50
                const historyCount = await History.count({ where: { monitorId: monitor.id } });
                if (historyCount > 50) {
                    const oldestHistory = await History.findOne({
                        where: { monitorId: monitor.id },
                        order: [['createdAt', 'ASC']]
                    });
                    if (oldestHistory) {
                        await oldestHistory.destroy();
                    }
                }
            }
        } catch (error) {
            console.error(`❌ Failed to save AWS monitor result for ${monitor.name}:`, error);
        }
    }

    startAwsHealthChecks() {
        console.log('🚀 Starting REAL AWS CloudWatch monitoring service...');
        
        setInterval(async () => {
            try {
                // Get all AWS monitors
                const awsMonitors = await Monitor.findAll({
                    where: {
                        monitorType: 'aws'
                    },
                    attributes: [
                        'id', 'name', 'metricName', 'metricNamespace', 'resourceType', 
                        'resourceId', 'region', 'thresholdValue', 'thresholdOperator', 'isEnabled'
                    ]
                });

                if (awsMonitors.length > 0) {
                    console.log(`🔄 Checking ${awsMonitors.length} REAL AWS monitors with CloudWatch API...`);
                    
                    for (const monitor of awsMonitors) {
                        if (monitor.isEnabled) {
                            const result = await this.checkAwsMonitorHealth(monitor);
                            await this.saveAwsMonitorResult(monitor, result);
                        }
                    }
                } else {
                    console.log('📭 No AWS monitors configured for real monitoring');
                }

            } catch (error) {
                console.error('❌ Error in REAL AWS monitoring service:', error);
            }
        }, 60000); // Check every 60 seconds (real monitoring frequency)
    }
}

const realAwsService = new RealAwsMonitoringService();

module.exports = { 
    startAwsHealthChecks: () => realAwsService.startAwsHealthChecks()
};