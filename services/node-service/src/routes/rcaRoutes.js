const express = require('express');
const router = express.Router();
const rcaController = require('../controllers/rcaController');

router.get('/logs/:monitorId', rcaController.getLogs);
router.get('/baseline/:monitorId', rcaController.getBaseline);
router.post('/report/:monitorId', rcaController.shareReport);

module.exports = router;
