const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs').promises;
const path = require('path');

// Get API key from environment
const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
    console.warn('[AgentEngine] WARNING: GEMINI_API_KEY not set in environment!');
}

const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

async function loadPrompt(promptName) {
    try {
        const promptPath = path.join(__dirname, 'prompts', `${promptName}.txt`);
        const content = await fs.readFile(promptPath, 'utf-8');
        console.log(`[AgentEngine] Loaded prompt: ${promptName}`);
        return content;
    } catch (error) {
        console.error(`[AgentEngine] Error loading prompt ${promptName}:`, error.message);
        throw error;
    }
}

async function callGemini(prompt) {
    if (!genAI) {
        console.error('[AgentEngine] Gemini API not initialized - missing API key');
        return {
            type: "error",
            summary: "AI Service Not Configured",
            answer: "The Gemini API key is not configured. Please set GEMINI_API_KEY in the environment variables.",
            error: true
        };
    }

    try {
        console.log('[AgentEngine] Calling Gemini API...');
        // Using gemini-2.5-pro - Same model as GitHub Copilot client
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-pro",
            generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 4096,
            }
        });
        
        // Retry logic for 503 errors and network failures
        let result;
        let retries = 3;
        for (let i = 0; i <= retries; i++) {
            try {
                result = await model.generateContent(prompt);
                break; // Success, exit retry loop
            } catch (err) {
                const errorMsg = err.message || '';
                const shouldRetry = errorMsg.includes('503') || errorMsg.includes('fetch failed') || errorMsg.includes('overloaded');
                
                if (shouldRetry && i < retries) {
                    const waitTime = (i + 1) * 2000; // Exponential backoff: 2s, 4s, 6s
                    console.log(`[AgentEngine] Gemini error (${errorMsg.substring(0, 50)}), retrying in ${waitTime/1000}s (${i + 1}/${retries})...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue;
                }
                throw err; // Re-throw if not retryable or out of retries
            }
        }
        
        const response = await result.response;
        const text = await response.text();
        
        console.log('[AgentEngine] Received response from Gemini');
        console.log('[AgentEngine] Response length:', text.length, 'characters');
        console.log('[AgentEngine] Raw response preview:', text.substring(0, 200) + '...');
        
        // Attempt to parse the JSON response from the model
        try {
            // Remove markdown code blocks if present
            let jsonString = text.trim();
            
            // Remove ```json or ``` markers
            jsonString = jsonString.replace(/^```json\s*/i, '').replace(/^```\s*/, '');
            jsonString = jsonString.replace(/\s*```$/, '');
            jsonString = jsonString.trim();
            
            const parsed = JSON.parse(jsonString);
            console.log('[AgentEngine] Successfully parsed JSON response');
            return parsed;
        } catch (parseError) {
            console.error('[AgentEngine] Failed to parse Gemini response as JSON:', parseError.message);
            console.error('[AgentEngine] Full response length:', text.length);
            console.error('[AgentEngine] Response text:', text);
            
            // Try to extract JSON from text if it's embedded
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    const extracted = JSON.parse(jsonMatch[0]);
                    console.log('[AgentEngine] Successfully extracted and parsed JSON from response');
                    return extracted;
                } catch (e) {
                    console.error('[AgentEngine] Failed to parse extracted JSON');
                }
            }
            
            // Return a structured error if parsing fails
            return {
                type: "error",
                summary: "Response Parsing Error",
                answer: text.length > 500 ? text.substring(0, 500) + '...' : text,
                error: true,
                details: "The AI returned a response in an unexpected format."
            };
        }
    } catch (error) {
        console.error('[AgentEngine] Error calling Gemini API:', error.message);
        return {
            type: "error",
            summary: "AI Service Error",
            answer: "Failed to communicate with the AI service. Please try again.",
            error: true,
            details: error.message
        };
    }
}

// Fetch monitor schema from backend
async function fetchMonitorSchema() {
    try {
        const axios = require('axios');
        const response = await axios.get('http://node-service:3000/api/monitors/schema', {
            timeout: 5000
        });
        return response.data;
    } catch (error) {
        console.warn('[AgentEngine] Could not fetch monitor schema:', error.message);
        return null;
    }
}

// Fetch historical metrics from SQLite database
async function fetchHistoricalMetrics(resourceId, metricName, timeRangeHours = 2) {
    try {
        const axios = require('axios');
        const endTime = new Date();
        const startTime = new Date(endTime.getTime() - (timeRangeHours * 60 * 60 * 1000));
        
        console.log(`[AgentEngine] Fetching historical metrics for ${resourceId}/${metricName} from ${startTime.toISOString()} to ${endTime.toISOString()}`);
        
        const response = await axios.get('http://node-service:3000/api/metrics-history/summary', {
            params: {
                resourceId: resourceId,
                metricName: metricName,
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString()
            },
            timeout: 10000
        });
        
        if (response.data && response.data.metrics && response.data.metrics.length > 0) {
            console.log(`[AgentEngine] Found ${response.data.metrics.length} historical data points`);
            return response.data.metrics;
        }
        
        console.log('[AgentEngine] No historical metrics found in database');
        return [];
    } catch (error) {
        console.warn('[AgentEngine] Could not fetch historical metrics:', error.message);
        return [];
    }
}

// Analyze historical metrics and create context
function analyzeMetricsData(metrics) {
    if (!metrics || metrics.length === 0) {
        return null;
    }
    
    const values = metrics.map(m => parseFloat(m.metricValue || m.value || 0));
    const timestamps = metrics.map(m => new Date(m.timestamp || m.createdAt));
    
    // Calculate statistics
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const latest = values[values.length - 1];
    const first = values[0];
    
    // Calculate trend
    const trend = latest > first ? (latest > avg ? 'increasing rapidly' : 'increasing') : 
                                  (latest < avg ? 'decreasing rapidly' : 'decreasing');
    
    // Check for sudden spikes
    const threshold = avg * 1.5;
    const spikes = values.filter(v => v > threshold).length;
    const hasSpikes = spikes > values.length * 0.1; // More than 10% of points are spikes
    
    return {
        dataPoints: metrics.length,
        timeRange: `${timestamps[0].toISOString()} to ${timestamps[timestamps.length - 1].toISOString()}`,
        currentValue: latest.toFixed(2),
        average: avg.toFixed(2),
        minimum: min.toFixed(2),
        maximum: max.toFixed(2),
        trend: trend,
        hasAnomalies: hasSpikes,
        spikeCount: spikes,
        rawData: metrics.slice(-10) // Last 10 data points for detailed analysis
    };
}

// Convert schema to prompt text
function schemaToPrompt(schema) {
    if (!schema) return '';
    
    let prompt = '\n\n=== ACTUAL BACKEND API SCHEMA (SOURCE OF TRUTH) ===\n';
    
    for (const [type, config] of Object.entries(schema)) {
        prompt += `\n## ${type.toUpperCase().replace('_', ' ')}\n`;
        prompt += `Endpoint: ${config.endpoint}\n`;
        prompt += `Required: ${config.required_fields.join(', ')}\n\n`;
        
        for (const [field, def] of Object.entries(config.fields)) {
            const req = config.required_fields.includes(field) ? 'REQUIRED' : 'optional';
            prompt += `  ${field} (${req}): ${def.type}\n`;
            if (def.enum) prompt += `    Options: ${def.enum.join(', ')}\n`;
            if (def.labels) prompt += `    UI Labels: ${def.labels.join(', ')}\n`;
            if (def.default !== undefined) prompt += `    Default: ${def.default}\n`;
        }
    }
    
    return prompt + '\n';
}

exports.runAgent = async (prompt, agentType, conversationHistory = []) => {
    try {
        console.log(`[AgentEngine] Running agent type: ${agentType}`);
        console.log(`[AgentEngine] User prompt: ${prompt.substring(0, 100)}...`);
        console.log(`[AgentEngine] Conversation history length: ${conversationHistory.length}`);
        
        // Load prompts
        const systemPrompt = await loadPrompt('agentSystemPrompt');
        let agentSpecificPrompt = '';

        switch (agentType) {
            case 'sre':
                agentSpecificPrompt = await loadPrompt('srePrompt');
                
                // Extract resource ID from prompt (looking for patterns like i-xxxxxxxxxx for EC2)
                const resourceIdMatch = prompt.match(/i-[a-z0-9]+/i);
                if (resourceIdMatch) {
                    const resourceId = resourceIdMatch[0];
                    console.log(`[AgentEngine] Detected resource ID: ${resourceId}, fetching historical data...`);
                    
                    // Fetch historical metrics for common metrics
                    const cpuMetrics = await fetchHistoricalMetrics(resourceId, 'CPUUtilization', 2);
                    const memoryMetrics = await fetchHistoricalMetrics(resourceId, 'MemoryUtilization', 2);
                    
                    if (cpuMetrics.length > 0 || memoryMetrics.length > 0) {
                        agentSpecificPrompt += '\n\n=== REAL HISTORICAL DATA FROM DATABASE ===\n';
                        
                        if (cpuMetrics.length > 0) {
                            const cpuAnalysis = analyzeMetricsData(cpuMetrics);
                            agentSpecificPrompt += `\n## CPU Utilization Analysis for ${resourceId}\n`;
                            agentSpecificPrompt += `- Data Points: ${cpuAnalysis.dataPoints}\n`;
                            agentSpecificPrompt += `- Time Range: ${cpuAnalysis.timeRange}\n`;
                            agentSpecificPrompt += `- Current Value: ${cpuAnalysis.currentValue}%\n`;
                            agentSpecificPrompt += `- Average: ${cpuAnalysis.average}%\n`;
                            agentSpecificPrompt += `- Min/Max: ${cpuAnalysis.minimum}% / ${cpuAnalysis.maximum}%\n`;
                            agentSpecificPrompt += `- Trend: ${cpuAnalysis.trend}\n`;
                            agentSpecificPrompt += `- Has Anomalies: ${cpuAnalysis.hasAnomalies} (${cpuAnalysis.spikeCount} spikes detected)\n`;
                            agentSpecificPrompt += `- Recent Data Points:\n${JSON.stringify(cpuAnalysis.rawData, null, 2)}\n`;
                        }
                        
                        if (memoryMetrics.length > 0) {
                            const memAnalysis = analyzeMetricsData(memoryMetrics);
                            agentSpecificPrompt += `\n## Memory Utilization Analysis for ${resourceId}\n`;
                            agentSpecificPrompt += `- Data Points: ${memAnalysis.dataPoints}\n`;
                            agentSpecificPrompt += `- Time Range: ${memAnalysis.timeRange}\n`;
                            agentSpecificPrompt += `- Current Value: ${memAnalysis.currentValue}%\n`;
                            agentSpecificPrompt += `- Average: ${memAnalysis.average}%\n`;
                            agentSpecificPrompt += `- Min/Max: ${memAnalysis.minimum}% / ${memAnalysis.maximum}%\n`;
                            agentSpecificPrompt += `- Trend: ${memAnalysis.trend}\n`;
                            agentSpecificPrompt += `- Has Anomalies: ${memAnalysis.hasAnomalies} (${memAnalysis.spikeCount} spikes detected)\n`;
                            agentSpecificPrompt += `- Recent Data Points:\n${JSON.stringify(memAnalysis.rawData, null, 2)}\n`;
                        }
                        
                        agentSpecificPrompt += '\n=== END HISTORICAL DATA ===\n';
                        agentSpecificPrompt += '\nIMPORTANT: Use the REAL historical data above for your analysis. Do NOT make up hypothetical scenarios. Base your root cause analysis on the actual metrics shown above.\n';
                        
                        console.log(`[AgentEngine] Added ${cpuMetrics.length + memoryMetrics.length} historical data points to prompt`);
                    } else {
                        console.log(`[AgentEngine] No historical data found for ${resourceId}`);
                        agentSpecificPrompt += `\n\nNote: No historical metrics found in database for ${resourceId}. This may be a new resource or metrics collection has not started yet.\n`;
                    }
                }
                break;
            case 'monitor':
                agentSpecificPrompt = await loadPrompt('monitorPrompt');
                // Fetch real-time schema for monitor creation
                const schema = await fetchMonitorSchema();
                if (schema) {
                    agentSpecificPrompt += schemaToPrompt(schema);
                    console.log('[AgentEngine] Monitor schema loaded from backend');
                }
                break;
            case 'automation':
                agentSpecificPrompt = await loadPrompt('automationPrompt');
                break;
            case 'knowledge':
                agentSpecificPrompt = await loadPrompt('knowledgePrompt');
                break;
            default:
                console.error(`[AgentEngine] Unknown agent type: ${agentType}`);
                throw new Error(`Unknown agent type: ${agentType}`);
        }

        // Build conversation context
        let conversationContext = '';
        if (conversationHistory && conversationHistory.length > 0) {
            conversationContext = '\n\n=== CONVERSATION HISTORY ===\n';
            conversationHistory.forEach((msg, idx) => {
                if (msg.role === 'user') {
                    conversationContext += `User: ${msg.content}\n`;
                } else if (msg.role === 'assistant') {
                    try {
                        const parsed = JSON.parse(msg.content);
                        conversationContext += `Assistant: ${parsed.answer || parsed.summary || 'Response sent'}\n`;
                    } catch {
                        conversationContext += `Assistant: ${msg.content.substring(0, 150)}\n`;
                    }
                }
            });
            conversationContext += '=== END HISTORY ===\n\n';
        }
        
        const finalPrompt = `${systemPrompt}\n\n${agentSpecificPrompt}${conversationContext}\n\nUser Query: "${prompt}"\n\nRemember: Return ONLY a valid JSON object, no markdown formatting.`;
        
        console.log('[AgentEngine] Final prompt length:', finalPrompt.length);
        
        const result = await callGemini(finalPrompt);
        console.log('[AgentEngine] Agent execution completed');
        
        return result;
    } catch (error) {
        console.error('[AgentEngine] Error in runAgent:', error.message);
        return {
            type: agentType || "error",
            summary: "Agent Execution Error",
            answer: "An error occurred while processing your request. Please try again.",
            error: true,
            details: error.message
        };
    }
};
