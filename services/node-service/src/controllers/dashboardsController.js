const db = require('../models');
const Dashboard = db.Dashboard;

exports.getAllDashboards = async (req, res) => {
    const dashboards = await Dashboard.findAll();
    res.json(dashboards);
};

exports.getDashboardById = async (req, res) => {
    const dashboard = await Dashboard.findByPk(req.params.id);
    if (dashboard) {
        res.json(dashboard);
    } else {
        res.status(404).json({ message: 'Dashboard not found' });
    }
};

exports.createDashboard = async (req, res) => {
    try {
        const dashboard = await Dashboard.create(req.body);
        res.status(201).json(dashboard);
    } catch (error) {
        res.status(400).json({ message: 'Invalid data provided for dashboard', details: error.message });
    }
};

exports.updateDashboard = async (req, res) => {
    try {
        const dashboard = await Dashboard.findByPk(req.params.id);
        if (dashboard) {
            await dashboard.update(req.body);
            res.json(dashboard);
        } else {
            res.status(404).json({ message: 'Dashboard not found' });
        }
    } catch (error) {
        res.status(400).json({ message: 'Invalid data provided for dashboard', details: error.message });
    }
};

exports.deleteDashboard = async (req, res) => {
    const dashboard = await Dashboard.findByPk(req.params.id);
    if (dashboard) {
        await dashboard.destroy();
        res.sendStatus(204);
    } else {
        res.status(404).json({ message: 'Dashboard not found' });
    }
};
