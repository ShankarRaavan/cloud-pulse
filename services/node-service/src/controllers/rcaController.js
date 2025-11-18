const db = require('../models');
const axios = require('axios');

exports.getLogs = async (req, res) => {
    try {
        const { monitorId } = req.params;
        const history = await db.History.findAll({ 
            where: { monitorId },
            order: [['createdAt', 'DESC']],
            limit: 100
        });

        if (!history || history.length === 0) {
            return res.status(200).json({ 
                response: 'No historical data available for this monitor. Please ensure the monitor has been running and collecting data.' 
            });
        }

        // Try to call AI service, but fallback to manual analysis if it fails
        try {
            const aiResponse = await axios.post('http://ai-service:9000/api/prompt', {
                prompt: 'Analyze the following monitor history and provide a detailed root cause analysis report. Include: 1) Summary of issues, 2) Error patterns, 3) Performance metrics, 4) Root causes, 5) Recommendations.',
                monitorHistory: history
            }, { timeout: 10000 });

            res.status(200).json(aiResponse.data);
        } catch (aiError) {
            console.error('AI Service unavailable, generating manual RCA:', aiError.message);
            
            // Generate manual RCA analysis
            const manualRCA = generateManualRCA(history);
            res.status(200).json({ response: manualRCA });
        }
    } catch (error) {
        console.error('Error in getLogs:', error);
        res.status(500).json({ 
            message: 'Error fetching RCA data', 
            error: error.message,
            response: 'Unable to generate RCA report. Please check the server logs and try again.'
        });
    }
};

function generateManualRCA(history) {
    const failures = history.filter(h => h.statusCode >= 400);
    const successCount = history.filter(h => h.statusCode >= 200 && h.statusCode < 400).length;
    const totalChecks = history.length;
    const uptimePercentage = ((successCount / totalChecks) * 100).toFixed(2);
    
    const responseTimes = history.map(h => h.responseTime);
    const avgResponseTime = (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length).toFixed(0);
    const maxResponseTime = Math.max(...responseTimes);
    const minResponseTime = Math.min(...responseTimes);
    
    const sortedTimes = [...responseTimes].sort((a, b) => a - b);
    const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
    const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)];
    
    const statusCodeDistribution = {};
    history.forEach(h => {
        const code = h.statusCode;
        statusCodeDistribution[code] = (statusCodeDistribution[code] || 0) + 1;
    });
    
    const recentFailures = failures.slice(0, 5);
    const lastCheck = history[0];
    
    let report = `# Root Cause Analysis Report

## Executive Summary
**Monitor Status:** ${failures.length > 0 ? '⚠️ Issues Detected' : '✅ Healthy'}
**Uptime:** ${uptimePercentage}%
**Total Checks:** ${totalChecks}
**Failures:** ${failures.length}
**Analysis Period:** ${new Date(history[history.length - 1].createdAt).toLocaleString()} to ${new Date(history[0].createdAt).toLocaleString()}

## Performance Metrics

**Response Time Statistics:**
- Average Response Time: ${avgResponseTime}ms
- Minimum Response Time: ${minResponseTime}ms
- Maximum Response Time: ${maxResponseTime}ms
- P95 Latency: ${p95}ms
- P99 Latency: ${p99}ms

## Status Code Distribution

`;

    Object.entries(statusCodeDistribution).forEach(([code, count]) => {
        const percentage = ((count / totalChecks) * 100).toFixed(1);
        const statusType = code >= 200 && code < 300 ? '✅' : code >= 400 && code < 500 ? '⚠️' : '❌';
        report += `- ${statusType} HTTP ${code}: ${count} occurrences (${percentage}%)\n`;
    });

    if (failures.length > 0) {
        report += `\n## Recent Failures

`;
        recentFailures.forEach((failure, idx) => {
            report += `**Failure #${idx + 1}**
- Timestamp: ${new Date(failure.createdAt).toLocaleString()}
- Status Code: ${failure.statusCode}
- Response Time: ${failure.responseTime}ms
- Error: ${failure.error || 'No error message recorded'}

`;
        });

        report += `\n## Root Cause Analysis

`;
        
        const highLatency = responseTimes.filter(rt => rt > avgResponseTime * 2).length;
        const highLatencyPercentage = ((highLatency / totalChecks) * 100).toFixed(1);
        
        if (highLatencyPercentage > 10) {
            report += `**High Latency Issues:**
- ${highLatencyPercentage}% of requests experienced high latency (>2x average)
- This may indicate server overload, network issues, or resource constraints
- Peak response time reached ${maxResponseTime}ms

`;
        }
        
        const has4xx = Object.keys(statusCodeDistribution).some(code => code >= 400 && code < 500);
        const has5xx = Object.keys(statusCodeDistribution).some(code => code >= 500);
        
        if (has4xx) {
            report += `**Client-Side Errors (4xx):**
- Authentication/authorization issues or invalid requests detected
- Review API credentials and request parameters
- Check for broken links or misconfigured endpoints

`;
        }
        
        if (has5xx) {
            report += `**Server-Side Errors (5xx):**
- Backend service is experiencing issues
- Possible causes: server overload, application crashes, or infrastructure problems
- Immediate attention required

`;
        }

        report += `\n## Recommendations

`;
        
        if (uptimePercentage < 99) {
            report += `- **Critical:** Uptime is below 99%. Investigate and fix the root cause immediately\n`;
        }
        
        if (highLatencyPercentage > 10) {
            report += `- Optimize backend performance to reduce response times\n`;
            report += `- Consider implementing caching mechanisms\n`;
            report += `- Review database query performance\n`;
        }
        
        if (has5xx) {
            report += `- Scale infrastructure to handle current load\n`;
            report += `- Implement proper error handling and logging\n`;
            report += `- Set up automated recovery mechanisms\n`;
        }
        
        report += `- Set up alerts for response time thresholds\n`;
        report += `- Monitor trends over longer periods to identify patterns\n`;
        report += `- Document and track recurring issues\n`;
        
    } else {
        report += `\n## Status

✅ **All Systems Operational**

No failures detected in the monitored period. The service is performing well with consistent response times.

## Recommendations

- Continue monitoring for performance degradation
- Maintain current infrastructure configuration
- Regular review of baseline metrics
- Proactive capacity planning for future growth
`;
    }

    report += `\n## Last Check Details

**Time:** ${new Date(lastCheck.createdAt).toLocaleString()}
**Status Code:** ${lastCheck.statusCode}
**Response Time:** ${lastCheck.responseTime}ms
**Data Length:** ${lastCheck.dataLength || 'N/A'} bytes

---
*This report was generated automatically based on historical monitoring data.*
`;

    return report;
}

exports.getBaseline = async (req, res) => {
    try {
        // In a real application, you would fetch baseline data from a database or another service
        const baseline = {
            avgResponseTime: 200,
            p95Latency: 500,
            successRate: 99.9
        };
        res.status(200).json(baseline);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching baseline', error: error.message });
    }
};

exports.shareReport = async (req, res) => {
    try {
        // In a real application, you would generate a report and send it via email or another channel
        res.status(200).json({ message: 'Report shared successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error sharing report', error: error.message });
    }
};
