const express = require('express');
const router = express.Router();
const awsCredentialController = require('../controllers/awsCredentialController');
const { authenticate } = require('../controllers/authController');

router.get('/', authenticate, awsCredentialController.getCredential);
router.post('/', authenticate, awsCredentialController.createOrUpdateCredential);
router.delete('/', authenticate, awsCredentialController.deleteCredential);

module.exports = router;
