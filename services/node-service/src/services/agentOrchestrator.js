const axios = require('axios');

// AI Service URL - using correct port 9000
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://ai-service:9000';

exports.processRequest = async (prompt, agentType, conversationHistory = []) => {
    try {
        console.log(`[AgentOrchestrator] Processing ${agentType} request...`);
        console.log(`[AgentOrchestrator] Prompt: ${prompt.substring(0, 100)}...`);
        console.log(`[AgentOrchestrator] History length: ${conversationHistory.length}`);
        
        const response = await axios.post(`${AI_SERVICE_URL}/ai/agent`, {
            prompt,
            agentType,
            conversationHistory,
        }, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 60000 // 60 second timeout for AI processing
        });
        
        console.log(`[AgentOrchestrator] Response received from AI service`);
        return response.data;
    } catch (error) {
        console.error('[AgentOrchestrator] Error communicating with AI service:', error.message);
        if (error.response) {
            console.error('[AgentOrchestrator] AI Service Response:', error.response.data);
            console.error('[AgentOrchestrator] Status:', error.response.status);
        }
        
        // Return a fallback response instead of throwing
        return {
            type: agentType,
            summary: 'AI service is currently unavailable',
            answer: 'The AI agent service is experiencing connectivity issues. Please try again in a moment.',
            error: true,
            details: error.message
        };
    }
};
