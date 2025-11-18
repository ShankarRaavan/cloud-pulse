const express = require('express');
const router = express.Router();
const monitorController = require('../controllers/monitorController');
const authController = require('../controllers/authController');
const { getMonitorApiSchema } = require('../services/monitorSchemaService');

// Temporarily disable auth for AWS monitor testing
// router.use(authController.authenticate);

// Get monitor API schema for AI Agent
router.get('/schema', (req, res) => {
    res.json(getMonitorApiSchema());
});

router.route('/')
    .get(monitorController.getAllMonitors)
    .post(monitorController.createMonitor);

router.route('/:id')
    .get(monitorController.getMonitorById)
    .put(monitorController.updateMonitor)
    .delete(monitorController.deleteMonitor);

router.get('/:id/history', monitorController.getMonitorHistory);

router.get('/:id/timeseries', monitorController.getMonitorTimeseries);

router.post('/refresh-token', monitorController.refreshTokenForCredential);

// AI Agent monitor creation endpoint
router.post('/create', monitorController.createMonitorFromAI);

module.exports = router;
