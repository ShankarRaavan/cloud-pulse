const express = require('express');
const router = express.Router();
const systemCredentialController = require('../controllers/systemCredentialController');

// Get all system credentials (masked)
router.get('/', systemCredentialController.getAllCredentials);

// Update a system credential
router.put('/', systemCredentialController.updateCredential);

module.exports = router;