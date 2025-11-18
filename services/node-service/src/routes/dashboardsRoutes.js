const express = require('express');
const router = express.Router();
const dashboardsController = require('../controllers/dashboardsController');

router.get('/', dashboardsController.getAllDashboards);
router.get('/:id', dashboardsController.getDashboardById);
router.post('/', dashboardsController.createDashboard);
router.put('/:id', dashboardsController.updateDashboard);
router.delete('/:id', dashboardsController.deleteDashboard);

module.exports = router;
