const express = require('express');
const router = express.Router();
const apiCredentialController = require('../controllers/apiCredentialController');
const { authenticate } = require('../controllers/authController');

router.get('/', authenticate, apiCredentialController.getAllCredentials);
router.post('/', authenticate, apiCredentialController.createCredential);
router.put('/:id', authenticate, apiCredentialController.updateCredential);
router.delete('/:id', authenticate, apiCredentialController.deleteCredential);

module.exports = router;
