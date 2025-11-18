const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const authController = require('../controllers/authController');

router.use(authController.authenticate);

router.route('/')
    .get(notificationController.getAllNotifications)
    .post(notificationController.createNotification);

router.route('/:id')
    .put(notificationController.updateNotification)
    .delete(notificationController.deleteNotification);

module.exports = router;
