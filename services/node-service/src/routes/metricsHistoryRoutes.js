const express = require('express');
const metricsHistoryController = require('../controllers/metricsHistoryController');
const auth = require('../middleware/auth'); // Assuming auth middleware exists

const router = express.Router();

// Apply authentication middleware to all routes
router.use(auth);

// Store metrics (bulk insert)
router.post('/store', metricsHistoryController.storeMetrics);

// Get metrics summary with filtering
router.get('/summary', metricsHistoryController.getMetricsSummary);

// Get anomalies
router.get('/anomalies', metricsHistoryController.getAnomalies);

// Get resource health status
router.get('/health', metricsHistoryController.getResourceHealth);

// Get trend analysis
router.get('/trends', metricsHistoryController.getTrendAnalysis);

// Get statistics overview
router.get('/statistics', metricsHistoryController.getStatistics);

// Cleanup old metrics
router.delete('/cleanup', metricsHistoryController.cleanupMetrics);

module.exports = router;