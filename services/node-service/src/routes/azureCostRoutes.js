const express = require('express');
const router = express.Router();
const azureCostController = require('../controllers/azureCostController');
// const authMiddleware = require('../middleware/auth'); // Temporarily disabled for consistency

// Cost data routes (temporarily without auth to match main Azure routes)
router.post('/all-data', azureCostController.getAllCostData);

// Filter data routes (temporarily without auth)
router.get('/subscriptions', azureCostController.getSubscriptions);
router.get('/resource-groups', azureCostController.getResourceGroups);

module.exports = router;
