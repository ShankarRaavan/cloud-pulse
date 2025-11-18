const db = require('../models');
const ApiCredential = db.ApiCredential;

exports.getAllCredentials = async (req, res) => {
    const credentials = await ApiCredential.findAll();
    res.json(credentials);
};

exports.createCredential = async (req, res) => {
    try {
        const credential = await ApiCredential.create(req.body);
        res.status(201).json(credential);
    } catch (error) {
        res.status(400).json({ message: 'Invalid data provided for credential', details: error.message });
    }
};

exports.updateCredential = async (req, res) => {
    try {
        const credential = await ApiCredential.findByPk(req.params.id);
        if (credential) {
            await credential.update(req.body);
            res.json(credential);
        } else {
            res.status(404).json({ message: 'Credential not found' });
        }
    } catch (error) {
        res.status(400).json({ message: 'Invalid data provided for credential', details: error.message });
    }
};

exports.deleteCredential = async (req, res) => {
    const credential = await ApiCredential.findByPk(req.params.id);
    if (credential) {
        await credential.destroy();
        res.sendStatus(204);
    } else {
        res.status(404).json({ message: 'Credential not found' });
    }
};
