const express = require('express');
const router = express.Router();
const costController = require('../controllers/costController');

router.post('/summary', costController.getCostSummary);
router.post('/by-service', costController.getCostByService);
router.post('/history', costController.getCostHistory);
router.post('/by-region', costController.getCostByRegion);

module.exports = router;
