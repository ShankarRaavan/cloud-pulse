const express = require('express');
const router = express.Router();
const credentialsController = require('../controllers/credentialsController');

router.get('/regions', credentialsController.getAwsRegions);

module.exports = router;
