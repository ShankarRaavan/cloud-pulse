const db = require('../models');
const Notification = db.Notification;

exports.getAllNotifications = async (req, res) => {
    const notifications = await Notification.findAll();
    res.json(notifications);
};

exports.createNotification = async (req, res) => {
    try {
        const notification = await Notification.create(req.body);
        res.status(201).json(notification);
    } catch (error) {
        res.status(400).json({ message: 'Invalid data for notification', details: error.message });
    }
};

exports.updateNotification = async (req, res) => {
    try {
        const notification = await Notification.findByPk(req.params.id);
        if (notification) {
            await notification.update(req.body);
            res.json(notification);
        } else {
            res.status(404).json({ message: 'Notification not found' });
        }
    } catch (error) {
        res.status(400).json({ message: 'Invalid data for notification', details: error.message });
    }
};

exports.deleteNotification = async (req, res) => {
    const notification = await Notification.findByPk(req.params.id);
    if (notification) {
        await notification.destroy();
        res.sendStatus(204);
    } else {
        res.status(404).json({ message: 'Notification not found' });
    }
};
