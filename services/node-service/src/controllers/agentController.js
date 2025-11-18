const agentOrchestrator = require('../services/agentOrchestrator');

const handleRequest = async (req, res, agentType) => {
    try {
        const { prompt, agentType: requestAgentType, conversationHistory } = req.body;
        
        // Use agentType from request body if provided, otherwise use parameter
        const finalAgentType = requestAgentType || agentType;
        
        console.log(`[AgentController] Handling ${finalAgentType} request`);
        console.log(`[AgentController] Prompt: ${prompt?.substring(0, 100)}...`);
        console.log(`[AgentController] Conversation history length: ${conversationHistory?.length || 0}`);
        
        if (!prompt) {
            return res.status(400).json({ 
                error: 'Missing required parameter: prompt',
                type: finalAgentType
            });
        }
        
        const result = await agentOrchestrator.processRequest(prompt, finalAgentType, conversationHistory);
        res.json(result);
    } catch (error) {
        console.error(`[AgentController] Error in ${agentType} agent:`, error);
        res.status(500).json({ 
            error: 'An error occurred while processing your request.',
            details: error.message,
            type: agentType
        });
    }
};

// Generic endpoint that accepts agentType in body
exports.ask = (req, res) => {
    const { agentType } = req.body;
    if (agentType) {
        handleRequest(req, res, agentType);
    } else {
        handleRequest(req, res, 'knowledge');
    }
};

// Specific endpoints for each agent type
exports.sreAnalysis = (req, res) => handleRequest(req, res, 'sre');
exports.createMonitor = (req, res) => handleRequest(req, res, 'monitor');
exports.generateAutomation = (req, res) => handleRequest(req, res, 'automation');
