/**
 * Monitor Schema Service
 * Provides the actual database schema to the AI Agent
 * This ensures AI creates configs matching the real backend structure
 */

const getMonitorApiSchema = () => {
    return {
        synthetic_monitor: {
            endpoint: '/api/monitors/create',
            description: 'Create a URL/HTTP synthetic monitor',
            required_fields: ['name', 'url'],
            fields: {
                name: {
                    type: 'string',
                    description: 'Monitor name',
                    example: 'Facebook Health Check'
                },
                url: {
                    type: 'string',
                    description: 'Full URL to monitor (must include https:// or http://)',
                    example: 'https://www.facebook.com'
                },
                method: {
                    type: 'string',
                    enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
                    default: 'GET',
                    description: 'HTTP method'
                },
                monitoringInterval: {
                    type: 'integer',
                    enum: [300, 900, 3600],
                    labels: ['5 minutes', '15 minutes', '1 hour'],
                    default: 300,
                    description: 'Check interval in seconds'
                },
                requestTimeout: {
                    type: 'integer',
                    default: 30,
                    min: 5,
                    max: 120,
                    description: 'Request timeout in seconds'
                },
                alertThreshold: {
                    type: 'integer',
                    default: 1,
                    min: 1,
                    max: 10,
                    description: 'Consecutive failures before alerting'
                },
                retryCount: {
                    type: 'integer',
                    default: 0,
                    min: 0,
                    max: 5,
                    description: 'Number of retries before marking as failed'
                },
                authType: {
                    type: 'string',
                    enum: ['NONE', 'BASIC', 'BEARER', 'API_KEY'],
                    default: 'NONE',
                    description: 'Authentication type for the monitored endpoint'
                },
                authUsername: {
                    type: 'string',
                    optional: true,
                    description: 'Username for BASIC auth',
                    required_when: 'authType === "BASIC"'
                },
                authPassword: {
                    type: 'string',
                    optional: true,
                    description: 'Password for BASIC auth',
                    required_when: 'authType === "BASIC"'
                },
                bearerToken: {
                    type: 'string',
                    optional: true,
                    description: 'Bearer token for BEARER auth',
                    required_when: 'authType === "BEARER"',
                    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
                },
                customHeaders: {
                    type: 'json_string',
                    optional: true,
                    description: 'Custom HTTP headers as JSON string',
                    example: '{"X-API-Key": "abc123", "Client-ID": "xyz789"}'
                },
                requestBody: {
                    type: 'json_string',
                    optional: true,
                    description: 'Request body for POST/PUT (JSON string)'
                },
                notifications: {
                    type: 'array',
                    optional: true,
                    description: 'Alert notification channels',
                    items: {
                        type: {
                            enum: ['Email', 'Slack', 'Webhook'],
                            description: 'Notification channel type'
                        },
                        config: {
                            Email: {
                                description: 'Email addresses to notify',
                                example: '{"recipients": ["admin@example.com", "ops@example.com"]}'
                            },
                            Slack: {
                                description: 'Slack webhook configuration',
                                example: '{"webhook_url": "https://hooks.slack.com/services/xxx", "channel": "#alerts"}'
                            },
                            Webhook: {
                                description: 'Custom webhook URL',
                                example: '{"url": "https://api.example.com/alerts"}'
                            }
                        }
                    }
                }
            }
        },
        
        aws_monitor: {
            endpoint: '/api/monitors',
            description: 'Create an AWS CloudWatch monitor',
            required_fields: ['name', 'monitorType', 'resourceType', 'metricName'],
            fields: {
                name: {
                    type: 'string',
                    description: 'Monitor name',
                    example: 'Production EC2 CPU Alert'
                },
                monitorType: {
                    type: 'string',
                    fixed: 'aws',
                    description: 'Must be "aws" for AWS monitors'
                },
                resourceType: {
                    type: 'string',
                    enum: ['ec2', 'rds', 'lambda', 'elb', 's3', 'dynamodb'],
                    description: 'AWS service type',
                    example: 'ec2'
                },
                resourceIds: {
                    type: 'json_string',
                    description: 'JSON array of resource IDs',
                    example: '["i-022397abab95701aa"]'
                },
                resourceNames: {
                    type: 'json_string',
                    optional: true,
                    description: 'JSON array of resource names for display'
                },
                metricName: {
                    type: 'string',
                    description: 'CloudWatch metric name',
                    examples: {
                        ec2: ['CPUUtilization', 'DiskReadOps', 'NetworkIn', 'StatusCheckFailed'],
                        rds: ['CPUUtilization', 'DatabaseConnections', 'FreeStorageSpace'],
                        lambda: ['Invocations', 'Errors', 'Duration', 'Throttles']
                    }
                },
                metricNamespace: {
                    type: 'string',
                    description: 'CloudWatch namespace',
                    example: 'AWS/EC2'
                },
                thresholdOperator: {
                    type: 'string',
                    enum: ['>', '<', '>=', '<='],
                    default: '>',
                    description: 'Comparison operator'
                },
                thresholdValue: {
                    type: 'float',
                    description: 'Threshold value (e.g., 80 for 80% CPU)',
                    example: 80.0
                },
                monitoringInterval: {
                    type: 'integer',
                    enum: [300, 900, 3600],
                    labels: ['5 minutes', '15 minutes', '1 hour'],
                    default: 300,
                    description: 'Collection interval in seconds'
                },
                region: {
                    type: 'string',
                    enum: ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1'],
                    labels: ['US East (N. Virginia)', 'US West (Oregon)', 'Europe (Ireland)', 'Asia Pacific (Singapore)'],
                    default: 'us-east-1',
                    description: 'AWS region'
                },
                isEnabled: {
                    type: 'boolean',
                    default: true,
                    description: 'Enable monitor immediately'
                }
            }
        }
    };
};

// Generate a human-readable schema for the AI prompt
const generateSchemaPrompt = () => {
    const schema = getMonitorApiSchema();
    
    let prompt = '=== ACTUAL BACKEND API SCHEMA ===\n\n';
    
    for (const [monitorType, config] of Object.entries(schema)) {
        prompt += `## ${monitorType.toUpperCase().replace('_', ' ')}\n`;
        prompt += `Endpoint: ${config.endpoint}\n`;
        prompt += `Description: ${config.description}\n`;
        prompt += `Required Fields: ${config.required_fields.join(', ')}\n\n`;
        
        prompt += 'Fields:\n';
        for (const [fieldName, fieldDef] of Object.entries(config.fields)) {
            const required = config.required_fields.includes(fieldName) ? '(REQUIRED)' : '(optional)';
            prompt += `  - ${fieldName} ${required}:\n`;
            prompt += `    Type: ${fieldDef.type}\n`;
            
            if (fieldDef.enum) {
                prompt += `    Options: ${fieldDef.enum.join(', ')}\n`;
                if (fieldDef.labels) {
                    prompt += `    Labels: ${fieldDef.labels.join(', ')}\n`;
                }
            }
            
            if (fieldDef.default !== undefined) {
                prompt += `    Default: ${fieldDef.default}\n`;
            }
            
            if (fieldDef.example) {
                prompt += `    Example: ${fieldDef.example}\n`;
            }
            
            if (fieldDef.examples) {
                prompt += `    Examples by service:\n`;
                for (const [service, examples] of Object.entries(fieldDef.examples)) {
                    prompt += `      ${service}: ${examples.join(', ')}\n`;
                }
            }
            
            prompt += `    Description: ${fieldDef.description}\n\n`;
        }
        
        prompt += '\n';
    }
    
    return prompt;
};

module.exports = {
    getMonitorApiSchema,
    generateSchemaPrompt
};
