// New real CloudWatch metric endpoint for monitoring integration
router.get('/api/cloudwatch/metric-data', async (req, res) => {
    try {
        console.log('🔍 Real CloudWatch metric request:', req.query);
        
        // Get credentials from headers
        const accessKeyId = req.headers['x-aws-access-key-id'];
        const secretAccessKey = req.headers['x-aws-secret-access-key'];
        const region = req.headers['x-aws-region'] || 'us-east-1';
        
        if (!accessKeyId || !secretAccessKey) {
            return res.status(400).json({
                error: 'AWS credentials not provided in headers'
            });
        }
        
        // Initialize AWS client with real credentials
        const cloudWatch = new CloudWatchClient({
            credentials: {
                accessKeyId: accessKeyId,
                secretAccessKey: secretAccessKey
            },
            region: region
        });
        
        const { namespace, metricName, resourceId, period = 300, statistic = 'Average' } = req.query;
        
        if (!namespace || !metricName) {
            return res.status(400).json({
                error: 'namespace and metricName are required'
            });
        }
        
        // Build dimensions based on resource type
        let dimensions = [];
        if (resourceId && namespace === 'AWS/EC2') {
            dimensions.push({
                Name: 'InstanceId',
                Value: resourceId
            });
        } else if (resourceId && namespace === 'AWS/RDS') {
            dimensions.push({
                Name: 'DBInstanceIdentifier', 
                Value: resourceId
            });
        } else if (resourceId && namespace === 'AWS/Lambda') {
            dimensions.push({
                Name: 'FunctionName',
                Value: resourceId
            });
        }
        
        // Get real CloudWatch metric data
        const endTime = new Date();
        const startTime = new Date(endTime.getTime() - (15 * 60 * 1000)); // Last 15 minutes
        
        const params = {
            Namespace: namespace,
            MetricName: metricName,
            Dimensions: dimensions,
            StartTime: startTime,
            EndTime: endTime,
            Period: parseInt(period),
            Statistics: [statistic]
        };
        
        console.log('📊 CloudWatch API params:', JSON.stringify(params, null, 2));
        
        const command = new GetMetricStatisticsCommand(params);
        const response = await cloudWatch.send(command);
        
        console.log('✅ CloudWatch API response:', response);
        
        // Format response
        const dataPoints = response.Datapoints?.map(point => ({
            timestamp: point.Timestamp,
            value: point[statistic],
            unit: response.Label || 'Count'
        })).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)) || [];
        
        res.json({
            success: true,
            namespace,
            metricName,
            resourceId,
            dataPoints,
            source: 'real-aws-cloudwatch'
        });
        
    } catch (error) {
        console.error('❌ CloudWatch API error:', error);
        res.status(500).json({
            error: 'Failed to fetch CloudWatch metric data',
            details: error.message,
            source: 'cloudwatch-api-error'
        });
    }
});