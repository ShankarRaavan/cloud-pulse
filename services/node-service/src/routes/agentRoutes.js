const express = require('express');
const router = express.Router();
const agentController = require('../controllers/agentController');

// Generic endpoint for knowledge assistant
router.post('/ask', agentController.ask);

// Endpoint for SRE analysis
router.post('/sre-analysis', agentController.sreAnalysis);

// Endpoint for monitor creation
router.post('/create-monitor', agentController.createMonitor);

// Endpoint for automation generation
router.post('/generate-automation', agentController.generateAutomation);

module.exports = router;
