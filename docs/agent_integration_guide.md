# AI Agent Module Integration Guide

This guide explains how to integrate the new AI Agent module into your existing CloudPulse 360 application.

## 1. Node Service Integration

You need to register the new agent routes in your main `node-service` application file.

**File to modify:** `services/node-service/src/index.js`

Add the following lines to import and use the agent routes:

```javascript
// Import the new agent routes
const agentRoutes = require('./routes/agentRoutes');

// ... somewhere after app is initialized (e.g., const app = express();)

// Use the agent routes with a base path
app.use('/api/agent', agentRoutes);
```

Make sure you add this near your other route definitions.

## 2. AI Service Port Mapping (Docker Compose)

The `ai-service` now exposes port `9000` for its own endpoints, but the `agentOrchestrator` in the `node-service` communicates with it directly via its service name (`http://ai-service:5000`). The existing configuration in `docker-compose.yml` should be sufficient as long as the `ai-service` is on the same Docker network as the `node-service`.

However, if you want to access the `ai-service` directly from your host machine for testing, you can expose its port.

**File to modify:** `docker-compose.yml`

Find the `ai-service` definition and add a `ports` section if it doesn't exist:

```yaml
services:
  # ... other services
  ai-service:
    build: ./services/ai-service
    ports:
      - "9000:9000" # Exposes port 9000 on the host
    environment:
      - GEMINI_API_KEY=${GEMINI_API_KEY}
    # ... rest of the configuration
```
**Note:** The `agentOrchestrator` is hardcoded to use port `5000` for the `ai-service`. You need to ensure the `ai-service` is running on port `5000` inside the docker network. My generated `index.js` for the `ai-service` has it running on port `9000`. You should change the port in `services/ai-service/src/index.js` from `9000` to `5000`.

## 3. Environment Variables

The `ai-service` requires a Gemini API key. Make sure you have it set in your `.env` file at the root of the project.

**.env file:**
```
GEMINI_API_KEY=your_gemini_api_key_here
```

## 4. Rebuild and Restart

After making these changes, you'll need to rebuild your Docker containers and restart the application.

```bash
docker-compose down
docker-compose build
docker-compose up -d
```

Your new AI Agent module should now be integrated and accessible.
