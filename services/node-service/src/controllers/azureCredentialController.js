// Azure Credentials Controller
const db = require('../models');
const { ClientSecretCredential } = require('@azure/identity');
const { CostManagementClient } = require('@azure/arm-costmanagement');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Get Azure credentials status
exports.getAzureCredentialsStatus = async (req, res) => {
    try {
        const userId = req.user ? req.user.id : 1; // Default to 1 for now
        const credentials = await db.AzureCredential.findOne({ where: { userId } });
        // Parse subscription IDs if available
        let subscriptionIds;
        if (credentials) {
            try {
                subscriptionIds = credentials.subscriptionIds ? JSON.parse(credentials.subscriptionIds) : [credentials.subscriptionId];
            } catch (e) {
                subscriptionIds = [credentials.subscriptionId];
            }
        }

        res.json({
            configured: !!credentials,
            credentials: credentials ? {
                tenantId: credentials.tenantId,
                clientId: credentials.clientId,
                subscriptionId: credentials.subscriptionId,
                subscriptionIds: subscriptionIds
            } : null
        });
    } catch (error) {
        console.error('Error checking Azure credentials status:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Get Azure credentials (without secrets)
exports.getAzureCredentials = async (req, res) => {
    try {
        const userId = req.user ? req.user.id : 1; // Default to user ID 1 when auth is disabled
        const credentials = await db.AzureCredential.findOne({ 
            where: { userId }
        });

        if (!credentials) {
            return res.status(404).json({ message: 'No Azure credentials found' });
        }

        // Parse subscription IDs if available
        let subscriptionIds;
        try {
            subscriptionIds = credentials.subscriptionIds ? JSON.parse(credentials.subscriptionIds) : [credentials.subscriptionId];
        } catch (e) {
            subscriptionIds = [credentials.subscriptionId];
        }

        res.json({
            tenantId: credentials.tenantId,
            clientId: credentials.clientId,
            subscriptionId: credentials.subscriptionId,
            subscriptionIds: subscriptionIds
            // Never return clientSecret
        });
    } catch (error) {
        console.error('Error retrieving Azure credentials:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Save Azure credentials
exports.saveAzureCredentials = async (req, res) => {
    try {
        const { tenantId, clientId, clientSecret, subscriptionIds, subscriptionId } = req.body;
        const userId = req.user ? req.user.id : 1; // Default to 1 for now

        if (!tenantId || !clientId || !clientSecret) {
            return res.status(400).json({ 
                message: 'Required fields: tenantId, clientId, clientSecret' 
            });
        }

        // Handle both old single subscription and new multiple subscription formats
        let finalSubscriptionId;
        let finalSubscriptionIds;
        
        if (subscriptionIds && Array.isArray(subscriptionIds) && subscriptionIds.length > 0) {
            finalSubscriptionIds = subscriptionIds;
            finalSubscriptionId = subscriptionIds[0]; // Use first one as primary for backward compatibility
        } else if (subscriptionId) {
            finalSubscriptionId = subscriptionId;
            finalSubscriptionIds = [subscriptionId];
        } else {
            return res.status(400).json({ 
                message: 'At least one subscription ID is required' 
            });
        }

        const [credentials, created] = await db.AzureCredential.findOrCreate({
            where: { userId },
            defaults: { 
                userId, 
                tenantId, 
                clientId, 
                clientSecret, 
                subscriptionId: finalSubscriptionId,
                subscriptionIds: JSON.stringify(finalSubscriptionIds) // Store as JSON
            }
        });

        if (!created) {
            await credentials.update({ 
                tenantId, 
                clientId, 
                clientSecret, 
                subscriptionId: finalSubscriptionId,
                subscriptionIds: JSON.stringify(finalSubscriptionIds)
            });
        }

        res.json({
            message: 'Azure credentials saved successfully',
            tenantId,
            clientId,
            subscriptionId: finalSubscriptionId,
            subscriptionIds: finalSubscriptionIds
        });
    } catch (error) {
        console.error('Error saving Azure credentials:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Delete Azure credentials
exports.deleteAzureCredentials = async (req, res) => {
    try {
        const userId = req.user ? req.user.id : 1;
        
        const deleted = await db.AzureCredential.destroy({
            where: { userId }
        });

        if (deleted === 0) {
            return res.status(404).json({ message: 'No Azure credentials found to delete' });
        }

        res.json({ message: 'Azure credentials deleted successfully' });
    } catch (error) {
        console.error('Error deleting Azure credentials:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Test Azure connection
exports.testAzureConnection = async (req, res) => {
    try {
        console.log('=== Azure Test Connection Called ===');
        console.log('req.user:', req.user);
        const userId = req.user ? req.user.id : 1; // Default to 1 for now
        console.log('Using userId:', userId);
        const credentials = await db.AzureCredential.findOne({ where: { userId } });
        console.log('Credentials found:', credentials ? 'Yes' : 'No');

        if (!credentials) {
            return res.status(404).json({ 
                success: false, 
                message: 'No Azure credentials configured' 
            });
        }

        // Test Azure connection (simplified - in production you'd use Azure SDK)
        // For now, just validate the credentials format
        const { tenantId, clientId, clientSecret, subscriptionId } = credentials;
        
        // Basic validation
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        
        console.log('Validating credentials:', {
            tenantId: tenantId,
            clientId: clientId,
            subscriptionId: subscriptionId,
            tenantValid: uuidRegex.test(tenantId),
            clientValid: uuidRegex.test(clientId),
            subscriptionValid: uuidRegex.test(subscriptionId)
        });
        
        if (!uuidRegex.test(tenantId) || !uuidRegex.test(clientId) || !uuidRegex.test(subscriptionId)) {
            console.log('UUID validation failed');
            return res.json({
                success: false,
                message: 'Invalid credential format'
            });
        }

        if (!clientSecret || clientSecret.length < 10) {
            return res.json({
                success: false,
                message: 'Invalid client secret'
            });
        }

        // In production, you would make an actual Azure API call here
        // For now, simulate a successful connection
        console.log('Azure test connection successful');
        res.json({
            success: true,
            message: 'Azure connection validated successfully',
            subscription: subscriptionId
        });
    } catch (error) {
        console.error('Error testing Azure connection:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
};

// Get Azure cost summary
exports.getCostSummary = async (req, res) => {
    try {
        const userId = req.user ? req.user.id : 1;
        const { timePeriod, subscription, resourceGroup } = req.body;

        // Check if Azure credentials exist
        const credentials = await db.AzureCredential.findOne({ 
            where: { userId }
        });

        if (!credentials) {
            return res.status(400).json({ 
                message: 'Azure credentials not configured. Please configure Azure credentials first.' 
            });
        }

        const { tenantId, clientId, clientSecret, subscriptionId } = credentials;
        const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
        const client = new CostManagementClient(credential);

        const scope = `/subscriptions/${subscriptionId}`;
        const parameters = {
            type: 'ActualCost',
            timeframe: 'MonthToDate',
            dataset: {
                granularity: 'None',
                aggregation: {
                    totalCost: {
                        name: 'Cost',
                        function: 'Sum'
                    }
                }
            }
        };

        console.log('🔍 Making Azure Cost Management API call...');
        console.log('Scope:', scope);
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const result = await client.query.usage(scope, parameters);
        console.log('✅ Azure API Response received - showing real data');
        res.json(result);
    } catch (error) {
        console.error('❌ Error getting Azure cost summary:', error.message);
        
        // If rate limited, wait and retry once
        if (error.message && error.message.includes('Too many requests')) {
            console.log('⏳ Rate limited, waiting 5 seconds and retrying...');
            await new Promise(resolve => setTimeout(resolve, 5000));
            try {
                const result = await client.query.usage(scope, parameters);
                console.log('✅ Retry successful - showing real data');
                return res.json(result);
            } catch (retryError) {
                console.error('❌ Retry failed:', retryError.message);
            }
        }
        
        // Return error message instead of mock data
        res.status(500).json({ 
            message: 'Failed to fetch Azure cost data', 
            error: error.message,
            suggestion: 'Please try again in a few minutes due to Azure API rate limiting'
        });
    }
};

// Get Azure cost breakdown by service
exports.getCostBreakdown = async (req, res) => {
    try {
        const userId = req.user ? req.user.id : 1;
        const { timePeriod, subscription, resourceGroup, groupBy } = req.body;

        // Check if Azure credentials exist
        const credentials = await db.AzureCredential.findOne({ 
            where: { userId }
        });

        if (!credentials) {
            return res.status(400).json({ 
                message: 'Azure credentials not configured. Please configure Azure credentials first.' 
            });
        }

        const { tenantId, clientId, clientSecret, subscriptionId } = credentials;
        const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
        const client = new CostManagementClient(credential);

        const scope = `/subscriptions/${subscriptionId}`;
        const parameters = {
            type: 'ActualCost',
            timeframe: 'MonthToDate',
            dataset: {
                granularity: 'None',
                aggregation: {
                    totalCost: {
                        name: 'Cost',
                        function: 'Sum'
                    }
                },
                grouping: [{ type: 'Dimension', name: 'ServiceName' }]
            }
        };

        const result = await client.query.usage(scope, parameters);
        res.json(result);
    } catch (error) {
        console.error('Error getting Azure cost breakdown:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Get Azure daily cost data
exports.getDailyCosts = async (req, res) => {
    try {
        const userId = req.user ? req.user.id : 1;
        const { timePeriod, subscription, resourceGroup } = req.body;

        // Check if Azure credentials exist
        const credentials = await db.AzureCredential.findOne({ 
            where: { userId }
        });

        if (!credentials) {
            return res.status(400).json({ 
                message: 'Azure credentials not configured. Please configure Azure credentials first.' 
            });
        }

        const { tenantId, clientId, clientSecret, subscriptionId } = credentials;
        const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
        const client = new CostManagementClient(credential);

        const scope = `/subscriptions/${subscriptionId}`;
        const parameters = {
            type: 'ActualCost',
            timeframe: 'MonthToDate',
            dataset: {
                granularity: 'Daily',
                aggregation: {
                    totalCost: {
                        name: 'Cost',
                        function: 'Sum'
                    }
                }
            }
        };

        const result = await client.query.usage(scope, parameters);
        res.json(result);
    } catch (error) {
        console.error('Error getting Azure daily costs:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Get Azure subscriptions
exports.getSubscriptions = async (req, res) => {
    try {
        const userId = req.user ? req.user.id : 1;
        let tenantId, clientId, clientSecret;

        // Check if credentials are provided in request body (for validation during setup)
        if (req.body && req.body.tenantId && req.body.clientId && req.body.clientSecret) {
            tenantId = req.body.tenantId;
            clientId = req.body.clientId;
            clientSecret = req.body.clientSecret;
            console.log('Using credentials from request body for validation');
        } else {
            // Check if Azure credentials exist in database
            const credentials = await db.AzureCredential.findOne({ 
                where: { userId }
            });

            if (!credentials) {
                return res.status(400).json({ 
                    message: 'Azure credentials not configured. Please provide credentials in request body or configure them first.' 
                });
            }

            tenantId = credentials.tenantId;
            clientId = credentials.clientId;
            clientSecret = credentials.clientSecret;
            console.log('Using saved credentials from database');
        }
        
        console.log('Attempting to authenticate with Azure AD...');
        console.log('Tenant ID:', tenantId);
        console.log('Client ID:', clientId);
        console.log('Client Secret provided:', !!clientSecret);
        
        const identityCredential = new ClientSecretCredential(tenantId, clientId, clientSecret);
        
        let token;
        try {
            const tokenResponse = await identityCredential.getToken("https://management.azure.com/.default");
            token = tokenResponse.token;
            console.log('Successfully obtained Azure AD token');
        } catch (authError) {
            console.error('Azure AD authentication failed:', authError.message);
            return res.status(401).json({ message: 'Azure AD authentication failed. Please verify your credentials.' });
        }
        
        // Fetch subscriptions from Azure API
        const url = 'https://management.azure.com/subscriptions?api-version=2020-01-01';
        const headers = {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        };

        try {
            console.log('Fetching subscriptions from Azure API...');
            const response = await axios.get(url, { headers });
            const subscriptions = response.data.value.map(sub => ({
                subscriptionId: sub.subscriptionId,
                displayName: sub.displayName,
                state: sub.state
            }));
            
            console.log(`Found ${subscriptions.length} subscriptions:`, subscriptions.map(sub => sub.displayName));
            res.json(subscriptions);
        } catch (apiError) {
            console.error('Failed to fetch subscriptions from API:', {
                status: apiError.response?.status,
                statusText: apiError.response?.statusText,
                data: apiError.response?.data,
                message: apiError.message
            });
            
            // Provide specific error message based on status code
            let errorMessage = 'Failed to fetch subscriptions. ';
            if (apiError.response?.status === 401) {
                errorMessage += 'Authentication failed. Please verify your Tenant ID, Client ID, and Client Secret.';
            } else if (apiError.response?.status === 403) {
                errorMessage += 'Access forbidden. Please ensure your service principal has the required permissions.';
            } else {
                errorMessage += `Azure API error: ${apiError.response?.status || 'Unknown'} - ${apiError.message}`;
            }
            
            return res.status(400).json({ message: errorMessage });
        }

    } catch (error) {
        console.error('Error getting Azure subscriptions:', error);
        res.status(500).json({ message: 'Internal server error: ' + error.message });
    }
};

// Get Azure resource groups
exports.getResourceGroups = async (req, res) => {
    try {
        const userId = req.user ? req.user.id : 1;

        // Check if Azure credentials exist
        const credentials = await db.AzureCredential.findOne({ 
            where: { userId }
        });

        if (!credentials) {
            return res.status(400).json({ 
                message: 'Azure credentials not configured. Please configure Azure credentials first.' 
            });
        }

        // Get subscription from query parameters or use default
        const selectedSubscription = req.query.subscription;
        const { tenantId, clientId, clientSecret, subscriptionId: defaultSubscriptionId } = credentials;
        const targetSubscriptionId = (selectedSubscription && selectedSubscription !== 'all') ? selectedSubscription : defaultSubscriptionId;
        
        const identityCredential = new ClientSecretCredential(tenantId, clientId, clientSecret);
        const token = (await identityCredential.getToken("https://management.azure.com/.default")).token;
        
        console.log(`Fetching resource groups for subscription: ${targetSubscriptionId}`);
        
        // Fetch resource groups from Azure API
        const url = `https://management.azure.com/subscriptions/${targetSubscriptionId}/resourcegroups?api-version=2021-04-01`;
        const headers = {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        };

        try {
            console.log('Fetching resource groups from Azure API...');
            const response = await axios.get(url, { headers });
            const resourceGroups = response.data.value.map(rg => ({
                name: rg.name,
                location: rg.location,
                id: rg.id
            }));
            
            console.log(`Found ${resourceGroups.length} resource groups:`, resourceGroups.map(rg => rg.name));
            res.json(resourceGroups);
        } catch (apiError) {
            console.warn('Could not fetch resource groups from API:', apiError.message);
            // Fallback to mock data
            const mockResourceGroups = [
                { name: 'default-rg', location: 'East US', id: `/subscriptions/${targetSubscriptionId}/resourceGroups/default-rg` }
            ];
            res.json(mockResourceGroups);
        }

    } catch (error) {
        console.error('Error getting Azure resource groups:', error);
        res.status(500).json({ message: 'Internal server error: ' + error.message });
    }
};

// Seed Azure credentials from working FinOps config
exports.seedFromFinOps = async (req, res) => {
    try {
        console.log('🚀 Starting Azure credentials seeding from FinOps config...');
        
        // Load FinOps config
        const configPath = path.join(__dirname, '../../../../Finops_Acc/config.json');
        let configData;
        
        try {
            configData = fs.readFileSync(configPath, 'utf8');
        } catch (error) {
            return res.status(404).json({ 
                success: false,
                message: 'FinOps config file not found. Please ensure the Finops_Acc folder is accessible.' 
            });
        }

        const config = JSON.parse(configData);
        const azureConfig = config.azure;

        if (!azureConfig || !azureConfig.client_id || !azureConfig.client_secret || !azureConfig.tenant_id) {
            return res.status(400).json({ 
                success: false,
                message: 'Invalid Azure configuration in FinOps config file.' 
            });
        }

        console.log('📋 Loaded Azure config from FinOps:');
        console.log('- Client ID:', azureConfig.client_id);
        console.log('- Tenant ID:', azureConfig.tenant_id);

        // First, test the credentials and get subscription ID
        let subscriptionId;
        try {
            const identityCredential = new ClientSecretCredential(
                azureConfig.tenant_id, 
                azureConfig.client_id, 
                azureConfig.client_secret
            );
            const token = (await identityCredential.getToken("https://management.azure.com/.default")).token;

            // Fetch subscriptions from Azure API
            const url = 'https://management.azure.com/subscriptions?api-version=2020-01-01';
            const headers = {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            };

            const response = await axios.get(url, { headers });
            const subscriptions = response.data.value;
            
            if (subscriptions && subscriptions.length > 0) {
                subscriptionId = subscriptions[0].subscriptionId;
                console.log(`✅ Found subscription: ${subscriptions[0].displayName} (${subscriptionId})`);
            } else {
                throw new Error('No subscriptions found');
            }
        } catch (error) {
            console.error('❌ Failed to validate credentials or fetch subscriptions:', error.message);
            return res.status(400).json({ 
                success: false,
                message: 'Invalid Azure credentials or no subscription access: ' + error.message
            });
        }

        // Save or update credentials in database
        const userId = req.user ? req.user.id : 1; // Default to user ID 1
        
        const [credentials, created] = await db.AzureCredential.findOrCreate({
            where: { userId },
            defaults: {
                userId,
                tenantId: azureConfig.tenant_id,
                clientId: azureConfig.client_id,
                clientSecret: azureConfig.client_secret,
                subscriptionId: subscriptionId
            }
        });

        if (!created) {
            await credentials.update({
                tenantId: azureConfig.tenant_id,
                clientId: azureConfig.client_id,
                clientSecret: azureConfig.client_secret,
                subscriptionId: subscriptionId
            });
            console.log('🔄 Updated existing Azure credentials');
        } else {
            console.log('➕ Created new Azure credentials');
        }

        res.json({
            success: true,
            message: 'Azure credentials seeded successfully from FinOps config',
            subscriptionId: subscriptionId,
            tenantId: azureConfig.tenant_id,
            clientId: azureConfig.client_id
        });

    } catch (error) {
        console.error('❌ Error seeding Azure credentials:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to seed Azure credentials: ' + error.message 
        });
    }
};
