const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { PythonShell } = require('python-shell');
const _ = require('lodash');
const moment = require('moment');
const agentEngine = require('./agentEngine');

const app = express();
const port = 9000;

app.use(bodyParser.json());
app.use(cors());

// Load the knowledge base
const toolGuidePath = path.join('/app', 'docs', 'tool_guide.md');
const toolGuide = fs.readFileSync(toolGuidePath, 'utf8');

const systemPrompt = `
You are an expert AI assistant for a monitoring application called Cloud Pulse 360.
Your role is to help users understand their monitoring data and provide insights.
You must only answer questions related to the application's data, which includes:
- Cost analysis
- Infrastructure monitoring (e.g., EC2, RDS)
- Synthetic URL monitoring

Here is a guide to the tool's features:
${toolGuide}

When you provide a response, you must format it using Markdown. Use headings, lists, and bold text to make the information clear and easy to read.

If a user asks a question that is not related to the application's data, you must politely decline to answer.
For example, if a user asks "What is the capital of India?", you should respond with:
"I'm sorry, I can only answer questions about your monitoring data."
`;

let chatHistory = [];

app.post('/api/prompt', async (req, res) => {
  try {
    console.log('Request Body:', req.body);
    const { prompt, window } = req.body;

    // Fetch real-time context
    console.log('Fetching real-time context...');
    const contextRes = await fetch('http://node-service:3000/api/ai/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ window })
    });
    console.log('Context response status:', contextRes.status);
    const context = await contextRes.json();
    const contextText = JSON.stringify(context.latest, null, 2);
    console.log('Context data:', contextText);

    // Fetch AWS credentials status
    const credsRes = await fetch('http://node-service:3000/api/ai/aws-credentials-status');
    const credsStatus = await credsRes.json();
    const credsConfigured = credsStatus.configured;

    let costText = 'AWS credentials are not configured.';
    if (credsConfigured) {
        // Fetch cost data
        const costRes = await fetch('http://node-service:3000/api/aws/cost/summary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ timeRange: window || '30d' })
        });
        const costData = await costRes.json();
        costText = JSON.stringify(costData, null, 2);
    }

    // Fetch monitors
    const monitorsRes = await fetch('http://node-service:3000/api/ai/monitors');
    const monitorsData = await monitorsRes.json();
    const monitorsText = JSON.stringify(monitorsData, null, 2);

    let historyText = '';
    if (req.body.monitorHistory) {
        historyText = JSON.stringify(req.body.monitorHistory, null, 2);
    } else if (req.body.monitorName) {
        const monitorsRes = await fetch('http://node-service:3000/api/ai/monitors');
        const monitors = await monitorsRes.json();
        const monitor = monitors.find(m => m.name.toLowerCase() === req.body.monitorName.toLowerCase());

        if (monitor) {
            const historyRes = await fetch('http://node-service:3000/api/ai/monitor-history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ monitorId: monitor.id })
            });
            const historyData = await historyRes.json();
            historyText = JSON.stringify(historyData, null, 2);
        }
    }

    // Get Gemini API key from headers (passed by node-service proxy)
    const geminiApiKey = req.headers['x-gemini-api-key'] || process.env.GEMINI_API_KEY;
    
    if (!geminiApiKey) {
      return res.status(500).json({ 
        error: "Gemini API key not configured", 
        message: "Please configure the Gemini API key in system settings" 
      });
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + geminiApiKey,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [
              { text: systemPrompt },
              { text: `Here is the latest monitoring data:\n${contextText}` },
              { text: `Here is the latest cost data:\n${costText}` },
              { text: `Here are the configured monitors:\n${monitorsText}` },
              { text: `Here is the monitor history:\n${historyText}` },
              { text: prompt }
          ] }],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API Error:", errorText);
      return res.status(500).json({ error: "Gemini API failed", details: errorText });
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response";
    res.json({ response: text });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Anomaly Detection Endpoint
app.post('/api/detect-anomalies', async (req, res) => {
    try {
        const { metrics_data, method = 'isolation_forest', thresholds = {} } = req.body;
        
        if (!metrics_data || !Array.isArray(metrics_data) || metrics_data.length === 0) {
            return res.status(400).json({
                error: 'metrics_data is required and must be a non-empty array'
            });
        }

        console.log(`Running anomaly detection with method: ${method} on ${metrics_data.length} data points`);

        const options = {
            mode: 'text',
            pythonPath: 'python3',
            pythonOptions: ['-u'],
            scriptPath: path.join(__dirname),
            args: []
        };

        const inputData = {
            method,
            metrics_data,
            thresholds
        };

        const results = await new Promise((resolve, reject) => {
            const pyshell = new PythonShell('anomaly_detection.py', options);
            
            // Send input data to Python script
            pyshell.send(JSON.stringify(inputData));
            
            let output = '';
            pyshell.on('message', (data) => {
                output += data;
            });

            pyshell.end((err, code, signal) => {
                if (err) {
                    console.error('Python script error:', err);
                    reject(err);
                } else {
                    try {
                        const result = JSON.parse(output);
                        resolve(result);
                    } catch (parseError) {
                        console.error('Failed to parse Python output:', output);
                        reject(new Error('Failed to parse anomaly detection results'));
                    }
                }
            });
        });

        console.log(`Anomaly detection completed: ${results.anomaly_count} anomalies found out of ${results.total_points} points`);
        
        res.json({
            success: true,
            results,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Anomaly detection error:', error);
        res.status(500).json({
            error: 'Anomaly detection failed',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// AWS Metrics Analysis Endpoint
app.post('/api/analyze-aws-metrics', async (req, res) => {
    try {
        const { 
            source = 'aws', 
            service, 
            resourceId, 
            metricName, 
            timeRange = '24h',
            analysisType = 'comprehensive'
        } = req.body;

        console.log(`Analyzing AWS metrics for ${service}/${metricName} over ${timeRange}`);

        // Fetch metrics data from node-service
        const metricsResponse = await fetch('http://node-service:3000/api/metrics-history/summary', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                source,
                service,
                resourceId,
                metricName,
                startTime: moment().subtract(getTimeRangeHours(timeRange), 'hours').toISOString(),
                endTime: moment().toISOString()
            })
        });

        if (!metricsResponse.ok) {
            throw new Error('Failed to fetch metrics data');
        }

        const metricsData = await metricsResponse.json();
        
        if (!metricsData.metrics || metricsData.metrics.length === 0) {
            return res.json({
                analysis: {
                    summary: 'No metrics data available for the specified parameters',
                    anomalies: [],
                    trends: [],
                    recommendations: []
                },
                dataPoints: 0
            });
        }

        // Run anomaly detection
        const anomalyResponse = await fetch(`http://localhost:${port}/api/detect-anomalies`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                metrics_data: metricsData.metrics,
                method: 'isolation_forest'
            })
        });

        const anomalyResults = await anomalyResponse.json();

        // Generate insights using Gemini AI
        const insights = await generateMetricsInsights(metricsData.metrics, anomalyResults.results, req.headers['x-gemini-api-key']);

        const analysis = {
            summary: {
                totalDataPoints: metricsData.metrics.length,
                timeRange,
                service,
                metricName,
                anomalyRate: anomalyResults.results.anomaly_rate,
                analysisTimestamp: new Date().toISOString()
            },
            anomalies: anomalyResults.results.anomalies,
            trends: calculateTrends(metricsData.metrics),
            statistics: calculateStatistics(metricsData.metrics),
            recommendations: insights.recommendations,
            aiInsights: insights.analysis
        };

        res.json({
            success: true,
            analysis,
            rawData: analysisType === 'detailed' ? metricsData.metrics : undefined
        });

    } catch (error) {
        console.error('AWS metrics analysis error:', error);
        res.status(500).json({
            error: 'AWS metrics analysis failed',
            details: error.message
        });
    }
});

// Real-time Anomaly Monitoring Endpoint
app.post('/api/monitor-anomalies', async (req, res) => {
    try {
        const { services = ['ec2', 'rds', 'lambda', 's3'], alertThreshold = 0.8 } = req.body;
        
        console.log(`Monitoring anomalies for services: ${services.join(', ')}`);

        const anomalyAlerts = [];
        
        for (const service of services) {
            try {
                // Get recent metrics for each service
                const metricsResponse = await fetch('http://node-service:3000/api/metrics-history/summary', {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        source: 'aws',
                        service,
                        startTime: moment().subtract(2, 'hours').toISOString(),
                        endTime: moment().toISOString(),
                        limit: 100
                    })
                });

                if (metricsResponse.ok) {
                    const metricsData = await metricsResponse.json();
                    
                    if (metricsData.metrics && metricsData.metrics.length > 10) {
                        // Run anomaly detection
                        const anomalyResponse = await fetch(`http://localhost:${port}/api/detect-anomalies`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                metrics_data: metricsData.metrics,
                                method: 'isolation_forest'
                            })
                        });

                        const anomalyResults = await anomalyResponse.json();
                        
                        // Filter high-severity anomalies
                        const highSeverityAnomalies = anomalyResults.results.anomalies.filter(
                            anomaly => anomaly.anomaly_score >= alertThreshold
                        );

                        if (highSeverityAnomalies.length > 0) {
                            anomalyAlerts.push({
                                service,
                                anomalies: highSeverityAnomalies,
                                severity: 'high',
                                count: highSeverityAnomalies.length,
                                timestamp: new Date().toISOString()
                            });
                        }
                    }
                }
            } catch (serviceError) {
                console.error(`Error monitoring ${service}:`, serviceError);
            }
        }

        res.json({
            success: true,
            alerts: anomalyAlerts,
            monitoring: {
                services,
                alertThreshold,
                timestamp: new Date().toISOString(),
                totalAlerts: anomalyAlerts.length
            }
        });

    } catch (error) {
        console.error('Anomaly monitoring error:', error);
        res.status(500).json({
            error: 'Anomaly monitoring failed',
            details: error.message
        });
    }
});

// Helper Functions
function getTimeRangeHours(timeRange) {
    const ranges = {
        '1h': 1,
        '6h': 6,
        '24h': 24,
        '7d': 168,
        '30d': 720
    };
    return ranges[timeRange] || 24;
}

function calculateTrends(metrics) {
    if (metrics.length < 2) return [];

    const sorted = _.sortBy(metrics, 'timestamp');
    const values = sorted.map(m => m.metricValue);
    
    // Calculate moving averages
    const shortMA = [];
    const longMA = [];
    const shortWindow = Math.min(12, Math.floor(values.length / 4));
    const longWindow = Math.min(24, Math.floor(values.length / 2));

    for (let i = 0; i < values.length; i++) {
        if (i >= shortWindow - 1) {
            const shortSum = values.slice(i - shortWindow + 1, i + 1).reduce((a, b) => a + b, 0);
            shortMA.push(shortSum / shortWindow);
        }
        
        if (i >= longWindow - 1) {
            const longSum = values.slice(i - longWindow + 1, i + 1).reduce((a, b) => a + b, 0);
            longMA.push(longSum / longWindow);
        }
    }

    return {
        trend: shortMA.length > 0 && longMA.length > 0 ? 
            (shortMA[shortMA.length - 1] > longMA[longMA.length - 1] ? 'increasing' : 'decreasing') : 'stable',
        shortMA,
        longMA,
        volatility: values.length > 1 ? calculateVolatility(values) : 0
    };
}

function calculateStatistics(metrics) {
    if (metrics.length === 0) return {};

    const values = metrics.map(m => m.metricValue);
    const sorted = [...values].sort((a, b) => a - b);
    
    return {
        mean: values.reduce((a, b) => a + b, 0) / values.length,
        median: sorted[Math.floor(sorted.length / 2)],
        min: Math.min(...values),
        max: Math.max(...values),
        std: calculateStandardDeviation(values),
        p95: sorted[Math.floor(sorted.length * 0.95)],
        p99: sorted[Math.floor(sorted.length * 0.99)]
    };
}

function calculateVolatility(values) {
    if (values.length < 2) return 0;
    
    const returns = [];
    for (let i = 1; i < values.length; i++) {
        if (values[i - 1] !== 0) {
            returns.push((values[i] - values[i - 1]) / values[i - 1]);
        }
    }
    
    return returns.length > 0 ? calculateStandardDeviation(returns) : 0;
}

function calculateStandardDeviation(values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
}

async function generateMetricsInsights(metricsData, anomalyResults, geminiApiKey) {
    if (!geminiApiKey) {
        return {
            analysis: 'AI analysis unavailable - Gemini API key not configured',
            recommendations: ['Configure Gemini API key for AI-powered insights']
        };
    }

    try {
        const stats = calculateStatistics(metricsData);
        const trends = calculateTrends(metricsData);
        
        const prompt = `
        Analyze the following AWS infrastructure metrics and anomalies:

        Metrics Summary:
        - Total data points: ${metricsData.length}
        - Time range: ${moment(metricsData[0]?.timestamp).fromNow()} to ${moment(metricsData[metricsData.length - 1]?.timestamp).fromNow()}
        - Mean value: ${stats.mean?.toFixed(2)}
        - Standard deviation: ${stats.std?.toFixed(2)}
        - Min/Max: ${stats.min?.toFixed(2)} / ${stats.max?.toFixed(2)}

        Anomalies Detected:
        - Anomaly count: ${anomalyResults.anomaly_count}
        - Anomaly rate: ${(anomalyResults.anomaly_rate * 100).toFixed(2)}%
        - Top anomalies: ${JSON.stringify(anomalyResults.anomalies.slice(0, 3), null, 2)}

        Trends:
        - Overall trend: ${trends.trend}
        - Volatility: ${trends.volatility?.toFixed(4)}

        Please provide:
        1. A concise analysis of the metrics patterns and anomalies
        2. Specific recommendations for optimization or alerting
        3. Risk assessment and potential impacts
        4. Next steps for investigation

        Format your response as a JSON object with 'analysis' and 'recommendations' fields.
        `;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            }
        );

        if (!response.ok) {
            throw new Error('Gemini API request failed');
        }

        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No AI analysis available";
        
        try {
            // Try to parse as JSON
            return JSON.parse(text);
        } catch (parseError) {
            // Fallback to plain text
            return {
                analysis: text,
                recommendations: ['Review the metrics patterns', 'Investigate anomalies', 'Set up monitoring alerts']
            };
        }

    } catch (error) {
        console.error('Error generating AI insights:', error);
        return {
            analysis: 'AI analysis failed - ' + error.message,
            recommendations: ['Review metrics manually', 'Check system performance', 'Validate data quality']
        };
    }
}

app.listen(port, () => {
    console.log(`AI service is running on http://localhost:${port}`);
    console.log('Available endpoints:');
    console.log('  POST /api/prompt - General AI chat');
    console.log('  POST /api/detect-anomalies - Anomaly detection');
    console.log('  POST /api/analyze-aws-metrics - AWS metrics analysis');
    console.log('  POST /api/monitor-anomalies - Real-time anomaly monitoring');
    console.log('  POST /ai/agent - New AI Agent endpoint');
});

app.post('/ai/agent', async (req, res) => {
    try {
        const { prompt, agentType, conversationHistory } = req.body;
        if (!prompt || !agentType) {
            return res.status(400).json({ error: 'prompt and agentType are required' });
        }
        const result = await agentEngine.runAgent(prompt, agentType, conversationHistory || []);
        res.json(result);
    } catch (error) {
        console.error('Error in AI agent endpoint:', error);
        res.status(500).json({ error: 'An error occurred in the AI agent.' });
    }
});
