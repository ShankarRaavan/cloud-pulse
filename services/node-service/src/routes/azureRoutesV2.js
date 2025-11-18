const express = require('express');
const router = express.Router();
const azureCredentialController = require('../controllers/azureCredentialController');
const authenticateToken = require('../middleware/auth');

// Route to get Azure credential status
router.get('/credentials/status', azureCredentialController.getAzureCredentialsStatus);

// Route to get Azure credentials (temporarily without auth)
router.get('/credentials', azureCredentialController.getAzureCredentials);

// Route to save Azure credentials
router.post('/credentials', azureCredentialController.saveAzureCredentials);

// Route to delete Azure credentials
router.delete('/credentials', azureCredentialController.deleteAzureCredentials);

// Route to test Azure connection (temporarily without auth)
router.post('/test-connection', azureCredentialController.testAzureConnection);

// Route to seed Azure credentials from FinOps config
router.post('/seed-from-finops', azureCredentialController.seedFromFinOps);

// Cost routes (temporarily without auth)
router.post('/cost/summary', azureCredentialController.getCostSummary);
router.post('/cost/breakdown', azureCredentialController.getCostBreakdown);
router.post('/cost/daily', azureCredentialController.getDailyCosts);
router.get('/subscriptions', azureCredentialController.getSubscriptions);
router.post('/subscriptions', azureCredentialController.getSubscriptions);
router.get('/resource-groups', azureCredentialController.getResourceGroups);

module.exports = router;
