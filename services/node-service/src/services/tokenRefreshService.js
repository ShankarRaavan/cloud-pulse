const axios = require('axios');
const db = require('../models');
const Monitor = db.Monitor;
const ApiCredential = db.ApiCredential;

async function refreshTokenForMonitor(monitor) {
    if (!monitor.credentialId) {
        return;
    }

    const credential = await ApiCredential.findByPk(monitor.credentialId);
    if (!credential) {
        return;
    }

    try {
        let response;
        const params = new URLSearchParams();
        params.append('client_id', credential.clientId);
        if (credential.scopes) {
            params.append('scope', credential.scopes);
        }

        if (credential.grantType === 'password_credentials') {
            params.append('grant_type', 'password');
            params.append('username', credential.username);
            params.append('password', credential.password);
        } else { // client_credentials
            params.append('grant_type', 'client_credentials');
            params.append('client_secret', credential.clientSecret);
        }

        response = await axios.post(credential.tokenUrl, params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const newToken = response.data.access_token;
        if (newToken) {
            const updatedData = { bearerToken: newToken };
            await monitor.update(updatedData);
            return updatedData;
        }
    } catch (error) {
        console.error(`Failed to refresh token for monitor ${monitor.name}:`, error.response ? error.response.data : error.message);
    }
}

function startTokenRefresh() {
    // Refresh tokens every 50 minutes (since they expire in 1 hour)
    setInterval(async () => {
        const monitors = await Monitor.findAll({
            where: {
                authType: 'BEARER',
                credentialId: {
                    [db.Sequelize.Op.ne]: null
                }
            }
        });
        monitors.forEach(refreshTokenForMonitor);
    }, 50 * 60 * 1000);
}

module.exports = { startTokenRefresh, refreshTokenForMonitor };
