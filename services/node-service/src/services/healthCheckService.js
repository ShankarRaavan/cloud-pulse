const axios = require('axios');
const { refreshTokenForMonitor } = require('./tokenRefreshService');
const db = require('../models');
const Monitor = db.Monitor;
const History = db.History;
const Notification = db.Notification;

// Track monitor status to detect changes
const monitorStatusCache = new Map();
// Track consecutive failure counts for alert threshold
const failureCountCache = new Map();

async function checkMonitorHealth(monitor) {
    // Skip AWS monitors - they should be handled by a separate AWS monitoring service
    if (monitor.monitorType === 'aws' || monitor.method === 'AWS' || (monitor.url && monitor.url.startsWith('aws://'))) {
        console.log(`⏭️ Skipping AWS monitor: ${monitor.name} (handled by AWS monitoring service)`);
        return;
    }

    if (monitor.authType === 'BEARER' && monitor.credentialId) {
        await refreshTokenForMonitor(monitor);
    }

    // Implement retry logic
    const maxRetries = monitor.retryCount || 0;
    let healthCheckResult = null;
    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const headers = monitor.customHeaders ? JSON.parse(monitor.customHeaders) : {};
            const auth = monitor.authType === 'BASIC' && monitor.authUsername && monitor.authPassword
                ? { username: monitor.authUsername, password: monitor.authPassword }
                : undefined;

            if (monitor.authType === 'BEARER' && monitor.bearerToken) {
                headers['Authorization'] = `Bearer ${monitor.bearerToken}`;
            }

            // Use monitor's requestTimeout (in seconds), default to 30
            const timeoutMs = (monitor.requestTimeout || 30) * 1000;

            const config = {
                method: monitor.method,
                url: monitor.url,
                data: monitor.requestBody ? JSON.parse(monitor.requestBody) : undefined,
                headers: headers,
                auth: auth,
                timeout: timeoutMs
            };

            const startTime = Date.now();
            const response = await axios(config);
            const endTime = Date.now();

            healthCheckResult = {
                statusCode: response.status,
                responseTime: endTime - startTime,
                dataLength: response.headers['content-length'] || JSON.stringify(response.data).length,
                status: 'Success',
                timestamp: new Date(),
                attempts: attempt + 1
            };
            
            // Success - break out of retry loop
            break;
        } catch (error) {
            lastError = error;
            
            // If this is not the last attempt, continue retrying
            if (attempt < maxRetries) {
                console.log(`⚠️ Monitor ${monitor.name} failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying...`);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between retries
                continue;
            }
            
            // All retries exhausted, record failure
            healthCheckResult = {
                statusCode: error.response ? error.response.status : 500,
                responseTime: 0,
                dataLength: 0,
                status: 'Fail',
                message: error.message,
                timestamp: new Date(),
                attempts: attempt + 1
            };
        }
    }

    // Verify monitor still exists before saving history
    const existingMonitor = await Monitor.findByPk(monitor.id);
    if (existingMonitor) {
        // Save the result to the database
        await History.create({
            monitorId: monitor.id,
            status: healthCheckResult.status,
            statusCode: healthCheckResult.statusCode,
            responseTime: healthCheckResult.responseTime,
            dataLength: healthCheckResult.dataLength,
            message: healthCheckResult.message
        });

        // Check if status changed and trigger notifications
        await checkAndTriggerAlerts(monitor, healthCheckResult);
    }
}

async function checkAndTriggerAlerts(monitor, healthCheckResult) {
    const previousStatus = monitorStatusCache.get(monitor.id);
    const currentStatus = healthCheckResult.status;
    const alertThreshold = monitor.alertThreshold || 1;
    
    // Track consecutive failures
    let failureCount = failureCountCache.get(monitor.id) || 0;
    
    if (currentStatus === 'Fail') {
        failureCount++;
        failureCountCache.set(monitor.id, failureCount);
        
        // Only alert if failure count reaches threshold
        if (failureCount < alertThreshold) {
            console.log(`⚠️ Monitor ${monitor.name} failed (${failureCount}/${alertThreshold}), waiting for threshold...`);
            monitorStatusCache.set(monitor.id, currentStatus);
            return;
        }
        
        // Threshold reached - check if we should alert
        const shouldAlert = previousStatus !== 'Fail' || failureCount === alertThreshold;
        
        if (!shouldAlert) {
            monitorStatusCache.set(monitor.id, currentStatus);
            return;
        }
        
        console.log(`🚨 Monitor ${monitor.name} reached failure threshold (${failureCount}/${alertThreshold}), triggering alert...`);
    } else {
        // Success - reset failure count
        const wasDown = failureCount >= alertThreshold;
        failureCountCache.set(monitor.id, 0);
        
        // Send recovery alert if monitor was down
        if (!wasDown || previousStatus !== 'Fail') {
            monitorStatusCache.set(monitor.id, currentStatus);
            return;
        }
        
        console.log(`✅ Monitor ${monitor.name} recovered after ${failureCount} failures`);
    }
    
    // Update cache after checking
    monitorStatusCache.set(monitor.id, currentStatus);
    
    // Get notifications linked to this specific monitor
    const monitorWithNotifications = await Monitor.findByPk(monitor.id, {
        include: [{
            model: Notification,
            through: { attributes: [] }
        }]
    });
    
    const notifications = monitorWithNotifications?.Notifications || [];
    
    if (notifications.length === 0) {
        console.log(`⚠️ No notification channels configured for monitor: ${monitor.name}`);
        return;
    }
    
    // Prepare alert data
    const isRecovery = currentStatus === 'Success' && previousStatus === 'Fail';
    const isOutage = currentStatus === 'Fail' && previousStatus === 'Success';
    
    const alert = {
        monitorId: monitor.id,
        monitorName: monitor.name,
        url: monitor.url,
        status: currentStatus,
        statusCode: healthCheckResult.statusCode,
        responseTime: healthCheckResult.responseTime,
        message: isRecovery 
            ? `✅ Monitor ${monitor.name} has RECOVERED`
            : `🔴 Monitor ${monitor.name} is DOWN`,
        timestamp: new Date().toISOString(),
        severity: currentStatus === 'Fail' ? 'critical' : 'info',
        alertType: isRecovery ? 'RECOVERY' : 'OUTAGE'
    };
    
    const alertIcon = isRecovery ? '✅' : '🚨';
    console.log(`${alertIcon} Triggering ${alert.alertType} alert for monitor: ${monitor.name} (${previousStatus} → ${currentStatus})`);
    
    // Send notifications to all configured channels
    for (const notification of notifications) {
        try {
            await sendNotification(notification, alert);
            console.log(`✅ Sent ${notification.type} notification for ${monitor.name}`);
        } catch (error) {
            console.error(`❌ Failed to send ${notification.type} notification:`, error.message);
        }
    }
}

async function sendNotification(notification, alert) {
    const notifType = notification.type?.toLowerCase();
    
    // Parse config if it's a JSON string
    let config = notification.config;
    console.log(`📋 Notification type: ${notifType}, config type: ${typeof config}`);
    console.log(`📋 Raw config:`, JSON.stringify(config));
    
    if (typeof config === 'string') {
        try {
            config = JSON.parse(config);
            console.log(`📋 Parsed config:`, JSON.stringify(config));
        } catch (e) {
            console.error('Failed to parse notification config:', e);
            return;
        }
    }
    
    switch (notifType) {
        case 'slack':
            return await sendSlackNotification(config, alert);
        case 'email':
            console.log(`📧 Email notification sent to ${config.recipients}`);
            // Email implementation would go here
            break;
        case 'webhook':
            return await sendWebhookNotification(config, alert);
        default:
            console.log(`⚠️ Unknown notification type: ${notification.type}`);
    }
}

async function sendSlackNotification(config, alert) {
    const webhookUrl = config.target || config.webhookUrl || config.slackUrl;
    
    if (!webhookUrl) {
        console.error('Slack config:', config);
        throw new Error('Slack webhook URL not configured');
    }
    
    const isRecovery = alert.alertType === 'RECOVERY';
    const color = isRecovery ? '#36a64f' : '#ff0000'; // Green for recovery, Red for outage
    const emoji = isRecovery ? '✅' : '🔴';
    const statusText = isRecovery ? 'RECOVERED' : 'DOWN';
    
    const slackMessage = {
        text: `${emoji} Monitor ${statusText}: ${alert.monitorName}`,
        attachments: [
            {
                color: color,
                title: alert.monitorName,
                fields: [
                    {
                        title: 'Alert Type',
                        value: alert.alertType,
                        short: true
                    },
                    {
                        title: 'Current Status',
                        value: alert.status,
                        short: true
                    },
                    {
                        title: 'URL',
                        value: alert.url,
                        short: true
                    },
                    {
                        title: 'Status Code',
                        value: alert.statusCode?.toString() || 'N/A',
                        short: true
                    },
                    {
                        title: 'Response Time',
                        value: `${alert.responseTime}ms`,
                        short: true
                    },
                    {
                        title: 'Message',
                        value: alert.message || 'No additional details',
                        short: false
                    },
                    {
                        title: 'Timestamp',
                        value: new Date(alert.timestamp).toLocaleString(),
                        short: false
                    }
                ],
                footer: 'Cloud Pulse 360',
                ts: Math.floor(Date.now() / 1000)
            }
        ]
    };
    
    const response = await axios.post(webhookUrl, slackMessage);
    return response.data;
}

async function sendWebhookNotification(config, alert) {
    const webhookUrl = config.target || config.webhookUrl || config.url;
    
    if (!webhookUrl) {
        throw new Error('Webhook URL not configured');
    }
    
    const payload = {
        event: 'monitor_alert',
        alert: alert,
        timestamp: Date.now()
    };
    
    const response = await axios.post(webhookUrl, payload);
    return response.data;
}

// Track last check time for each monitor
const lastCheckTimes = new Map();

function startHealthChecks() {
    // Check every 15 seconds, but only execute monitors that are due
    setInterval(async () => {
        const monitors = await Monitor.findAll({
            attributes: [
                'id', 'name', 'url', 'method', 'requestBody', 'customHeaders',
                'authType', 'authUsername', 'authPassword', 'bearerToken', 'credentialId',
                'monitorType', 'monitoringInterval', 'retryCount', 'requestTimeout', 'alertThreshold'
            ]
        });
        
        const now = Date.now();
        
        for (const monitor of monitors) {
            const lastCheck = lastCheckTimes.get(monitor.id) || 0;
            const interval = (monitor.monitoringInterval || 300) * 1000; // Convert seconds to milliseconds
            
            // Check if enough time has passed since last check
            if (now - lastCheck >= interval) {
                lastCheckTimes.set(monitor.id, now);
                checkMonitorHealth(monitor);
            }
        }
    }, 15000); // Base check interval: 15 seconds (scheduler frequency)
}

module.exports = { startHealthChecks };
