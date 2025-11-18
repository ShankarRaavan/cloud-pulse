const db = require('../models');
const AwsCredential = db.AwsCredential;

exports.getCredential = async (req, res) => {
    const credential = await AwsCredential.findOne();
    if (credential) {
        res.json(credential);
    } else {
        res.status(404).json({ message: 'Credential not found' });
    }
};

exports.createOrUpdateCredential = async (req, res) => {
    try {
        let credential = await AwsCredential.findOne();
        if (credential) {
            await credential.update(req.body);
        } else {
            credential = await AwsCredential.create(req.body);
        }
        res.status(200).json(credential);
    } catch (error) {
        res.status(400).json({ message: 'Invalid data provided for credential', details: error.message });
    }
};

exports.deleteCredential = async (req, res) => {
    const credential = await AwsCredential.findOne();
    if (credential) {
        await credential.destroy();
        res.sendStatus(204);
    } else {
        res.status(404).json({ message: 'Credential not found' });
    }
};
