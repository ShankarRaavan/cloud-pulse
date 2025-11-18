const express = require('express');
const nodemailer = require('nodemailer');
const axios = require('axios');
const router = express.Router();

// In-memory storage for alert configurations (in production, use database)
let alertConfigurations = [];
let alertHistory = [];
let alertConfigCounter = 0;

/**
 * Advanced Multi-Channel Alerting System
 * Supports: Email, Slack, Webhook, SMS notifications with templating
 */

// Email transporter configuration
let emailTransporter = null;

function initializeEmailTransporter(config) {
    emailTransporter = nodemailer.createTransporter({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
            user: config.user,
            pass: config.password
        }
    });
}

// Alert Configuration CRUD Routes

// Get all alert configurations
router.get('/alert-configs', (req, res) => {
    res.json({
        success: true,
        data: alertConfigurations,
        count: alertConfigurations.length
    });
});

// Create new alert configuration
router.post('/alert-configs', async (req, res) => {
    try {
        const {
            name,
            description,
            conditions,
            notifications,
            enabled = true,
            escalation = null,
            suppressionRules = null
        } = req.body;

        // Validate required fields
        if (!name || !conditions || !notifications || notifications.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: name, conditions, or notifications'
            });
        }

        // Validate conditions
        for (const condition of conditions) {
            if (!condition.metric || !condition.operator || condition.value === undefined) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid condition: must have metric, operator, and value'
                });
            }
        }

        // Validate notifications
        for (const notification of notifications) {
            if (!notification.type || !notification.config) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid notification: must have type and config'
                });
            }
        }

        const alertConfig = {
            id: ++alertConfigCounter,
            name,
            description: description || '',
            conditions,
            notifications,
            enabled,
            escalation,
            suppressionRules,
            createdAt: new Date().toISOString(),
            lastTriggered: null,
            triggerCount: 0
        };

        alertConfigurations.push(alertConfig);

        console.log(`✅ Created alert configuration: ${name}`);
        res.status(201).json({
            success: true,
            data: alertConfig
        });

    } catch (error) {
        console.error('Error creating alert configuration:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create alert configuration',
            details: error.message
        });
    }
});

// Update alert configuration
router.put('/alert-configs/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const alertIndex = alertConfigurations.findIndex(config => config.id === parseInt(id));

        if (alertIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'Alert configuration not found'
            });
        }

        const updatedConfig = {
            ...alertConfigurations[alertIndex],
            ...req.body,
            id: parseInt(id), // Preserve ID
            updatedAt: new Date().toISOString()
        };

        alertConfigurations[alertIndex] = updatedConfig;

        console.log(`✅ Updated alert configuration: ${updatedConfig.name}`);
        res.json({
            success: true,
            data: updatedConfig
        });

    } catch (error) {
        console.error('Error updating alert configuration:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update alert configuration',
            details: error.message
        });
    }
});

// Delete alert configuration
router.delete('/alert-configs/:id', (req, res) => {
    try {
        const { id } = req.params;
        const alertIndex = alertConfigurations.findIndex(config => config.id === parseInt(id));

        if (alertIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'Alert configuration not found'
            });
        }

        const deletedConfig = alertConfigurations.splice(alertIndex, 1)[0];

        console.log(`🗑️ Deleted alert configuration: ${deletedConfig.name}`);
        res.json({
            success: true,
            message: 'Alert configuration deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting alert configuration:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete alert configuration',
            details: error.message
        });
    }
});

// Alert Triggering and Processing

// Evaluate metric against alert conditions
router.post('/evaluate-alerts', async (req, res) => {
    try {
        const { metricData } = req.body;

        if (!metricData || !Array.isArray(metricData)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid metric data'
            });
        }

        const triggeredAlerts = [];

        for (const config of alertConfigurations) {
            if (!config.enabled) continue;

            const shouldTrigger = evaluateAlertConditions(config.conditions, metricData);
            
            if (shouldTrigger) {
                const alert = await processTriggeredAlert(config, metricData);
                triggeredAlerts.push(alert);
            }
        }

        res.json({
            success: true,
            triggeredAlerts: triggeredAlerts.length,
            alerts: triggeredAlerts
        });

    } catch (error) {
        console.error('Error evaluating alerts:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to evaluate alerts',
            details: error.message
        });
    }
});

// Test alert notification
router.post('/test-notification', async (req, res) => {
    try {
        const { type, config, message } = req.body;

        const testAlert = {
            id: 'test-alert',
            name: 'Test Alert',
            severity: 'info',
            message: message || 'This is a test alert from Cloud Pulse 360',
            timestamp: new Date().toISOString(),
            source: 'Test System'
        };

        const result = await sendNotification(type, config, testAlert);

        res.json({
            success: true,
            result: result
        });

    } catch (error) {
        console.error('Error sending test notification:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send test notification',
            details: error.message
        });
    }
});

// Get alert history
router.get('/alert-history', (req, res) => {
    const { limit = 100, offset = 0, severity } = req.query;

    let filteredHistory = alertHistory;
    if (severity) {
        filteredHistory = alertHistory.filter(alert => alert.severity === severity);
    }

    const paginatedHistory = filteredHistory
        .slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    res.json({
        success: true,
        data: paginatedHistory,
        total: filteredHistory.length,
        limit: parseInt(limit),
        offset: parseInt(offset)
    });
});

// Email Configuration
router.post('/configure-email', (req, res) => {
    try {
        const { host, port, secure, user, password } = req.body;

        if (!host || !port || !user || !password) {
            return res.status(400).json({
                success: false,
                error: 'Missing required email configuration'
            });
        }

        initializeEmailTransporter({ host, port, secure, user, password });

        res.json({
            success: true,
            message: 'Email configuration updated successfully'
        });

    } catch (error) {
        console.error('Error configuring email:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to configure email',
            details: error.message
        });
    }
});

// Helper Functions

function evaluateAlertConditions(conditions, metricData) {
    for (const condition of conditions) {
        const metricValue = getMetricValue(condition.metric, metricData);
        
        if (metricValue === null || metricValue === undefined) {
            continue; // Skip if metric not found
        }

        const passes = evaluateCondition(metricValue, condition.operator, condition.value);
        
        // For now, use AND logic (all conditions must pass)
        // In production, you'd support configurable logic (AND/OR)
        if (!passes) {
            return false;
        }
    }
    
    return conditions.length > 0; // Only trigger if there are conditions
}

function evaluateCondition(value, operator, threshold) {
    switch (operator) {
        case '>': return value > threshold;
        case '>=': return value >= threshold;
        case '<': return value < threshold;
        case '<=': return value <= threshold;
        case '==': return value == threshold;
        case '!=': return value != threshold;
        default: return false;
    }
}

function getMetricValue(metricName, metricData) {
    const metric = metricData.find(m => m.name === metricName);
    return metric ? metric.value : null;
}

async function processTriggeredAlert(config, metricData) {
    const alert = {
        id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        configId: config.id,
        name: config.name,
        severity: determineSeverity(config, metricData),
        message: generateAlertMessage(config, metricData),
        timestamp: new Date().toISOString(),
        source: 'AWS CloudWatch',
        metricData: metricData,
        notifications: []
    };

    // Update alert configuration stats
    config.lastTriggered = alert.timestamp;
    config.triggerCount++;

    // Send notifications
    for (const notification of config.notifications) {
        try {
            const result = await sendNotification(notification.type, notification.config, alert);
            alert.notifications.push({
                type: notification.type,
                status: 'success',
                result: result
            });
        } catch (error) {
            console.error(`Failed to send ${notification.type} notification:`, error);
            alert.notifications.push({
                type: notification.type,
                status: 'failed',
                error: error.message
            });
        }
    }

    // Store in alert history
    alertHistory.unshift(alert);
    
    // Keep only last 1000 alerts to prevent memory issues
    if (alertHistory.length > 1000) {
        alertHistory = alertHistory.slice(0, 1000);
    }

    console.log(`🚨 Alert triggered: ${alert.name} (${alert.severity})`);
    return alert;
}

function determineSeverity(config, metricData) {
    // Simple severity logic - can be enhanced
    const highValueMetrics = metricData.filter(m => m.value > 90);
    if (highValueMetrics.length > 0) return 'critical';
    
    const mediumValueMetrics = metricData.filter(m => m.value > 70);
    if (mediumValueMetrics.length > 0) return 'warning';
    
    return 'info';
}

function generateAlertMessage(config, metricData) {
    const metricSummary = metricData.map(m => `${m.name}: ${m.value}${m.unit || ''}`).join(', ');
    return `Alert "${config.name}" triggered. Metrics: ${metricSummary}`;
}

async function sendNotification(type, config, alert) {
    switch (type) {
        case 'email':
            return await sendEmailNotification(config, alert);
        case 'slack':
            return await sendSlackNotification(config, alert);
        case 'webhook':
            return await sendWebhookNotification(config, alert);
        case 'teams':
            return await sendTeamsNotification(config, alert);
        default:
            throw new Error(`Unsupported notification type: ${type}`);
    }
}

async function sendEmailNotification(config, alert) {
    if (!emailTransporter) {
        throw new Error('Email transporter not configured');
    }

    const htmlTemplate = generateEmailTemplate(alert);
    
    const mailOptions = {
        from: config.from || '"Cloud Pulse 360" <alerts@cloudpulse360.com>',
        to: config.recipients.join(', '),
        subject: `${getSeverityIcon(alert.severity)} [${alert.severity.toUpperCase()}] ${alert.name}`,
        html: htmlTemplate
    };

    const result = await emailTransporter.sendMail(mailOptions);
    return {
        messageId: result.messageId,
        recipients: config.recipients.length
    };
}

async function sendSlackNotification(config, alert) {
    const slackMessage = {
        text: `Alert: ${alert.name}`,
        attachments: [{
            color: getSeverityColor(alert.severity),
            title: alert.name,
            text: alert.message,
            fields: [
                {
                    title: 'Severity',
                    value: alert.severity.toUpperCase(),
                    short: true
                },
                {
                    title: 'Time',
                    value: new Date(alert.timestamp).toLocaleString(),
                    short: true
                },
                {
                    title: 'Source',
                    value: alert.source,
                    short: true
                }
            ],
            footer: 'Cloud Pulse 360',
            ts: Math.floor(Date.parse(alert.timestamp) / 1000)
        }]
    };

    const response = await axios.post(config.webhookUrl, slackMessage);
    return {
        status: response.status,
        channel: config.channel || 'webhook'
    };
}

async function sendWebhookNotification(config, alert) {
    const payload = {
        alert: alert,
        timestamp: new Date().toISOString(),
        source: 'cloud-pulse-360'
    };

    const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'CloudPulse360-AlertManager/1.0'
    };

    // Add custom headers if specified
    if (config.headers) {
        Object.assign(headers, config.headers);
    }

    const response = await axios.post(config.url, payload, {
        headers: headers,
        timeout: config.timeout || 30000
    });

    return {
        status: response.status,
        statusText: response.statusText,
        url: config.url
    };
}

async function sendTeamsNotification(config, alert) {
    const teamsMessage = {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "themeColor": getSeverityColor(alert.severity),
        "summary": `Alert: ${alert.name}`,
        "sections": [{
            "activityTitle": `🚨 ${alert.name}`,
            "activitySubtitle": alert.message,
            "facts": [
                {
                    "name": "Severity",
                    "value": alert.severity.toUpperCase()
                },
                {
                    "name": "Time",
                    "value": new Date(alert.timestamp).toLocaleString()
                },
                {
                    "name": "Source",
                    "value": alert.source
                }
            ]
        }],
        "potentialAction": [{
            "@type": "OpenUri",
            "name": "View Dashboard",
            "targets": [{
                "os": "default",
                "uri": config.dashboardUrl || "http://localhost:8080/advanced_aws_dashboard.html"
            }]
        }]
    };

    const response = await axios.post(config.webhookUrl, teamsMessage);
    return {
        status: response.status,
        team: config.team || 'webhook'
    };
}

// Template and Formatting Functions

function generateEmailTemplate(alert) {
    const severityColor = getSeverityColor(alert.severity);
    const severityIcon = getSeverityIcon(alert.severity);
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Alert: ${alert.name}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; }
        .header { background-color: ${severityColor}; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; }
        .alert-box { background-color: #f8f9fa; border-left: 4px solid ${severityColor}; padding: 15px; margin: 20px 0; }
        .metrics-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .metrics-table th, .metrics-table td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        .metrics-table th { background-color: #f8f9fa; }
        .footer { background-color: #343a40; color: white; padding: 15px; text-align: center; font-size: 12px; }
        .button { display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${severityIcon} Alert Triggered</h1>
            <p>${alert.name}</p>
        </div>
        <div class="content">
            <div class="alert-box">
                <h3>Alert Details</h3>
                <p><strong>Severity:</strong> ${alert.severity.toUpperCase()}</p>
                <p><strong>Time:</strong> ${new Date(alert.timestamp).toLocaleString()}</p>
                <p><strong>Source:</strong> ${alert.source}</p>
                <p><strong>Message:</strong> ${alert.message}</p>
            </div>
            
            ${alert.metricData && alert.metricData.length > 0 ? `
            <h3>Metric Data</h3>
            <table class="metrics-table">
                <thead>
                    <tr>
                        <th>Metric</th>
                        <th>Value</th>
                        <th>Unit</th>
                    </tr>
                </thead>
                <tbody>
                    ${alert.metricData.map(metric => `
                        <tr>
                            <td>${metric.name}</td>
                            <td>${metric.value}</td>
                            <td>${metric.unit || '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            ` : ''}
            
            <p style="text-align: center; margin-top: 30px;">
                <a href="http://localhost:8080/advanced_aws_dashboard.html" class="button">
                    View Dashboard
                </a>
            </p>
        </div>
        <div class="footer">
            <p>This alert was generated by Cloud Pulse 360 monitoring system.</p>
            <p>To stop receiving these notifications, please contact your system administrator.</p>
        </div>
    </div>
</body>
</html>
    `;
}

function getSeverityColor(severity) {
    switch (severity) {
        case 'critical': return '#dc3545';
        case 'warning': return '#fd7e14';
        case 'info': return '#17a2b8';
        default: return '#6c757d';
    }
}

function getSeverityIcon(severity) {
    switch (severity) {
        case 'critical': return '🔴';
        case 'warning': return '🟡';
        case 'info': return '🔵';
        default: return '⚪';
    }
}

module.exports = router;