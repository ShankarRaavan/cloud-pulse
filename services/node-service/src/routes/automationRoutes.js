const express = require('express');
const router = express.Router();
const automationController = require('../controllers/automationController');

router.get('/', automationController.getAllAutomations);
router.get('/:id', automationController.getAutomationById);
router.post('/', automationController.createAutomation);
router.put('/:id', automationController.updateAutomation);
router.delete('/:id', automationController.deleteAutomation);

// GitHub integration endpoints
router.post('/github/test', automationController.testGitHubRepository);
router.post('/github/branches', automationController.fetchGitHubBranches);
router.post('/github/scripts', automationController.fetchGitHubScripts);
router.post('/:id/sync', automationController.syncGitHubAutomation);

// Output viewing endpoint
router.get('/:id/output', automationController.getAutomationOutput);

module.exports = router;
