const { CostExplorerClient, GetCostAndUsageCommand, GetCostForecastCommand } = require('@aws-sdk/client-cost-explorer');

function getCostExplorerClient(accessKeyId, secretAccessKey, region) {
    if (!accessKeyId || !secretAccessKey || !region) {
        throw new Error('AWS credentials are not configured.');
    }
    return new CostExplorerClient({
        region: region,
        credentials: {
            accessKeyId: accessKeyId,
            secretAccessKey: secretAccessKey,
        },
    });
}

function getTimePeriod(period) {
    const today = new Date();
    let startDate, endDate = today;

    switch (period) {
        case '7d':
            startDate = new Date();
            startDate.setDate(today.getDate() - 7);
            break;
        case 'this_month':
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            break;
        case '30d':
            startDate = new Date();
            startDate.setDate(today.getDate() - 30);
            break;
        case 'last_month':
            startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            endDate = new Date(today.getFullYear(), today.getMonth(), 0);
            break;
        default:
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            break;
    }

    return {
        Start: startDate.toISOString().split('T')[0],
        End: endDate.toISOString().split('T')[0],
    };
}

const getCostSummary = async (period = 'mtd', accessKeyId, secretAccessKey, region, aws_default_region) => {
    const costExplorerClient = getCostExplorerClient(accessKeyId, secretAccessKey, aws_default_region);
    const today = new Date();
    const timePeriod = getTimePeriod(period);

    const costParams = {
        TimePeriod: timePeriod,
        Granularity: 'MONTHLY',
        Metrics: ['UnblendedCost'],
        Filter: region === 'all' ? null : {
            Dimensions: {
                Key: 'REGION',
                Values: [region]
            }
        }
    };

    const forecastParams = {
        TimePeriod: {
            Start: today.toISOString().split('T')[0],
            End: new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0],
        },
        Granularity: 'MONTHLY',
        Metric: 'UNBLENDED_COST',
    };

    try {
        const costData = await costExplorerClient.send(new GetCostAndUsageCommand(costParams));
        const mtdSpend = parseFloat(costData.ResultsByTime[0]?.Total.UnblendedCost.Amount || 0);

        let forecastData = {};
        try {
            forecastData = await costExplorerClient.send(new GetCostForecastCommand(forecastParams));
        } catch (e) {
            if (e.name === 'DataUnavailableException') {
                console.warn('Cost forecast data is unavailable.');
            } else {
                throw e;
            }
        }
        
        const forecastEom = parseFloat(forecastData.Total?.Amount || 0);

        const summary = {
            mtdSpend,
            weekOverWeek: 0,
            forecastEom,
            forecastChange: 0,
            budget: 0,
            anomalies: { count: 0, amount: 0 },
            spCoverage: 0,
            tagCoverage: 0,
        };
        return summary;

    } catch (error) {
        console.error('Error fetching cost summary:', error);
        throw error;
    }
};

const getCostByService = async (period = 'mtd', accessKeyId, secretAccessKey, region, aws_default_region) => {
    const costExplorerClient = getCostExplorerClient(accessKeyId, secretAccessKey, aws_default_region);
    const timePeriod = getTimePeriod(period);

    const params = {
        TimePeriod: timePeriod,
        Granularity: 'MONTHLY',
        Metrics: ['UnblendedCost'],
        GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }],
        Filter: region === 'all' ? undefined : {
            Dimensions: {
                Key: 'REGION',
                Values: [region]
            }
        }
    };

    try {
        const data = await costExplorerClient.send(new GetCostAndUsageCommand(params));
        
        if (!data.ResultsByTime || data.ResultsByTime.length === 0 || !data.ResultsByTime[0].Groups) {
            console.log('No cost data available for services');
            return { items: [] };
        }
        
        const items = data.ResultsByTime[0].Groups
            .map(group => ({
                service: group.Keys[0],
                cost: parseFloat(group.Metrics.UnblendedCost.Amount),
                prevMtd: 0,
                forecastEom: 0,
                budget: 0,
                trend: [1, 2, 3, 4, 5] // Mock trend data
            }))
            .filter(item => item.cost > 0) // Only include services with actual cost
            .sort((a, b) => b.cost - a.cost); // Sort by cost descending
            
        console.log(`Found ${items.length} services with costs`);
        return { items };
    } catch (error) {
        console.error('Error fetching cost by service:', error.message);
        return { items: [] }; // Return empty array instead of throwing
    }
};

const getCostHistory = async (period = '30d', accessKeyId, secretAccessKey, region, aws_default_region) => {
    const costExplorerClient = getCostExplorerClient(accessKeyId, secretAccessKey, aws_default_region);
    const timePeriod = getTimePeriod(period);

    const params = {
        TimePeriod: timePeriod,
        Granularity: 'DAILY',
        Metrics: ['UnblendedCost'],
        GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }],
        Filter: region === 'all' ? undefined : {
            Dimensions: {
                Key: 'REGION',
                Values: [region]
            }
        }
    };

    try {
        const data = await costExplorerClient.send(new GetCostAndUsageCommand(params));
        
        if (!data.ResultsByTime || data.ResultsByTime.length === 0) {
            console.log('No historical cost data available');
            return { dates: [], byService: {} };
        }
        
        const dates = data.ResultsByTime.map(result => new Date(result.TimePeriod.Start).toLocaleDateString('en-GB',{day:'2-digit',month:'short'}));
        const byService = {};
        
        data.ResultsByTime.forEach(result => {
            if (!result.Groups) return;
            
            result.Groups.forEach(group => {
                const service = group.Keys[0];
                const cost = parseFloat(group.Metrics.UnblendedCost.Amount);
                
                if (cost > 0) { // Only track services with actual costs
                    if (!byService[service]) {
                        byService[service] = new Array(dates.length).fill(0);
                    }
                    const dateIndex = dates.indexOf(new Date(result.TimePeriod.Start).toLocaleDateString('en-GB',{day:'2-digit',month:'short'}));
                    if (dateIndex >= 0) {
                        byService[service][dateIndex] = cost;
                    }
                }
            });
        });
        
        console.log(`Found ${dates.length} days with ${Object.keys(byService).length} services`);
        return { dates, byService };
    } catch (error) {
        console.error('Error fetching cost history:', error.message);
        return { dates: [], byService: {} }; // Return empty instead of throwing
    }
};

const getCostByRegion = async (period = '30d', accessKeyId, secretAccessKey, region, aws_default_region) => {
    const costExplorerClient = getCostExplorerClient(accessKeyId, secretAccessKey, aws_default_region);
    const timePeriod = getTimePeriod(period);

    const params = {
        TimePeriod: timePeriod,
        Granularity: 'DAILY',
        Metrics: ['UnblendedCost'],
        GroupBy: [{ Type: 'DIMENSION', Key: 'REGION' }],
        Filter: region === 'all' ? undefined : {
            Dimensions: {
                Key: 'REGION',
                Values: [region]
            }
        }
    };

    try {
        const data = await costExplorerClient.send(new GetCostAndUsageCommand(params));
        
        if (!data.ResultsByTime || data.ResultsByTime.length === 0) {
            console.log('No regional cost data available');
            return { items: [] };
        }
        
        const regionData = {};
        let maxCost = 0;

        data.ResultsByTime.forEach(day => {
            if (!day.Groups) return;
            
            day.Groups.forEach(group => {
                const regionName = group.Keys[0];
                const cost = parseFloat(group.Metrics.UnblendedCost.Amount);
                
                if (cost > 0) {
                    if (!regionData[regionName]) {
                        regionData[regionName] = [];
                    }
                    regionData[regionName].push(cost);
                    if (cost > maxCost) maxCost = cost;
                }
            });
        });

        const items = Object.keys(regionData)
            .map(regionName => ({
                region: regionName,
                pct: 0,
                series: regionData[regionName].map(cost => maxCost > 0 ? cost / maxCost : 0) // Normalize to 0-1
            }))
            .filter(item => item.series.length > 0);

        console.log(`Found ${items.length} regions with costs`);
        return { items };
    } catch (error) {
        console.error('Error fetching cost by region:', error.message);
        return { items: [] }; // Return empty instead of throwing
    }
};


module.exports = {
    getCostSummary,
    getCostByService,
    getCostHistory,
    getCostByRegion,
};
