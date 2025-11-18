// Seed Azure Credentials Helper Script
const db = require('../models');
const fs = require('fs');
const path = require('path');

// Load FinOps config that has working credentials
const loadFinOpsConfig = () => {
    const configPath = path.join(__dirname, '../../../../Finops_Acc/config.json');
    try {
        const configData = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(configData);
        return config.azure;
    } catch (error) {
        console.error('Error loading FinOps config:', error.message);
        return null;
    }
};

// Seed Azure credentials for user ID 1 (default user)
const seedAzureCredentials = async () => {
    try {
        const azureConfig = loadFinOpsConfig();
        
        if (!azureConfig) {
            throw new Error('Could not load Azure config from FinOps');
        }

        // We need to find a subscription ID - let's use a placeholder for now
        // In production, you would fetch this from Azure API
        const subscriptionId = "b3319d30-fc5a-4e05-978f-35f8b1b78e75"; // This should be replaced with actual subscription ID

        const userId = 1; // Default user

        // Check if credentials already exist
        const existingCredentials = await db.AzureCredential.findOne({ where: { userId } });
        
        if (existingCredentials) {
            await existingCredentials.update({
                tenantId: azureConfig.tenant_id,
                clientId: azureConfig.client_id,
                clientSecret: azureConfig.client_secret,
                subscriptionId: subscriptionId
            });
        } else {
            await db.AzureCredential.create({
                userId: userId,
                tenantId: azureConfig.tenant_id,
                clientId: azureConfig.client_id,
                clientSecret: azureConfig.client_secret,
                subscriptionId: subscriptionId
            });
        }

        return true;
    } catch (error) {
        console.error('Error seeding Azure credentials:', error.message);
        return false;
    }
};

// Function to get Azure subscriptions and update the credential with correct subscription ID
const updateWithRealSubscriptionId = async () => {
    try {
        const { ClientSecretCredential } = require('@azure/identity');
        const axios = require('axios');
        
        const credentials = await db.AzureCredential.findOne({ where: { userId: 1 } });
        if (!credentials) {
            throw new Error('No credentials found to update');
        }

        const { tenantId, clientId, clientSecret } = credentials;
        const identityCredential = new ClientSecretCredential(tenantId, clientId, clientSecret);
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
            const firstSubscription = subscriptions[0];
            
            await credentials.update({
                subscriptionId: firstSubscription.subscriptionId
            });
            
            return true;
        } else {
            throw new Error('No subscriptions found for this account');
        }
    } catch (error) {
        console.error('Error updating subscription ID:', error.message);
        return false;
    }
};

module.exports = {
    seedAzureCredentials,
    updateWithRealSubscriptionId
};

// If run directly
if (require.main === module) {
    (async () => {
        try {
            const seeded = await seedAzureCredentials();
            if (seeded) {
                await updateWithRealSubscriptionId();
            }
            console.log('Azure credentials seeding completed successfully');
        } catch (error) {
            console.error('Azure credentials seeding failed:', error.message);
        }
        process.exit(0);
    })();
}