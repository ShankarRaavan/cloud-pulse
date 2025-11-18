const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const credentialsRoutes = require('./routes/credentialsRoutes');
const costRoutes = require('./routes/costRoutes');
const monitoringRoutes = require('./routes/monitoringRoutes');

const app = express();
const port = 8000;

// Add top-level Node.js error handlers to capture fatal errors
process.on('uncaughtException', (err) => {
    console.error('[FATAL ERROR - uncaughtException]', err && err.stack ? err.stack : err);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[FATAL ERROR - unhandledRejection]', reason && reason.stack ? reason.stack : reason);
    console.error('Unhandled Rejection at:', promise);
    process.exit(1);
});

app.use(bodyParser.json());
app.use(cors());

app.use('/api/cost', costRoutes);
app.use('/api/credentials', credentialsRoutes);
app.use('/api', monitoringRoutes);

app.get('/', (req, res) => {
    res.send('AWS Monitoring Backend (JS) is running');
});


// Global error handler (logs all uncaught errors)
app.use((err, req, res, next) => {
    console.error('[GLOBAL ERROR]', err && err.stack ? err.stack : err);
    res.status(500).json({ message: 'Internal Server Error', error: err && err.message ? err.message : String(err) });
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
