document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const sendButton = document.getElementById('send-button');
    const promptInput = document.getElementById('prompt-input');
    const chatWindow = document.getElementById('chat-window');
    const actionButtons = document.querySelectorAll('.action-button');
    const clearChatBtn = document.getElementById('clear-chat');
    const activeModeLabel = document.getElementById('active-mode');
    const contextSummary = document.getElementById('context-summary');
    const exampleButtons = document.querySelectorAll('.example-btn');

    let activeAgent = 'sre'; // Default agent mode
    const agentModeNames = {
        'sre': 'SRE Assistant',
        'monitor': 'Monitor Creation',
        'automation': 'Automation Agent',
        'knowledge': 'Knowledge Assistant'
    };

    // Conversation state for monitor creation
    let conversationHistory = [];
    let pendingMonitorConfig = null;

    // Initialize
    init();

    function init() {
        // Load conversation history from localStorage
        loadConversationFromStorage();
        
        // Set up event listeners
        actionButtons.forEach(button => {
            button.addEventListener('click', () => {
                actionButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                activeAgent = button.dataset.agent;
                activeModeLabel.textContent = agentModeNames[activeAgent];
                updateContextPanel();
            });
        });

        exampleButtons.forEach(button => {
            button.addEventListener('click', () => {
                const example = button.dataset.example;
                promptInput.value = example;
                promptInput.focus();
            });
        });

        sendButton.addEventListener('click', sendMessage);
        clearChatBtn.addEventListener('click', clearChat);
        
        const exportBtn = document.getElementById('export-chat');
        if (exportBtn) {
            exportBtn.addEventListener('click', exportConversation);
        }
        
        promptInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        // Auto-resize textarea
        promptInput.addEventListener('input', () => {
            promptInput.style.height = 'auto';
            promptInput.style.height = promptInput.scrollHeight + 'px';
        });
    }

    async function sendMessage() {
        const prompt = promptInput.value.trim();
        if (!prompt) return;

        // Append user message
        appendUserMessage(prompt);
        
        // Add to conversation history
        conversationHistory.push({ role: 'user', content: prompt });
        
        // Save to localStorage
        saveConversationToStorage();
        
        promptInput.value = '';
        promptInput.style.height = 'auto';

        // Show loading indicator
        const loadingId = showLoading();

        try {
            // Include conversation history for context
            const response = await callAgentApi(prompt, activeAgent, conversationHistory);
            removeLoading(loadingId);
            
            // Add assistant response to history
            conversationHistory.push({ role: 'assistant', content: JSON.stringify(response) });
            
            // Save to localStorage
            saveConversationToStorage();
            
            appendAgentMessage(response);
            updateContextPanel(response);
            
            // Check if monitor is ready to create
            if (response.ready_to_create && response.monitor_config) {
                pendingMonitorConfig = response.monitor_config;
                showCreateMonitorButton(response.monitor_config);
            }
        } catch (error) {
            console.error('Error calling agent API:', error);
            removeLoading(loadingId);
            appendAgentMessage({
                type: 'error',
                summary: 'Connection Error',
                answer: 'Sorry, I encountered an error while processing your request. Please try again.',
                error: true
            });
        }
    }

    function appendUserMessage(text) {
        const container = document.createElement('div');
        container.className = 'chat-message-container user';
        
        container.innerHTML = `
            <div class="avatar user-avatar">
                <i class="fas fa-user"></i>
            </div>
            <div class="user-message">
                ${escapeHtml(text)}
            </div>
        `;
        
        chatWindow.appendChild(container);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }

    function appendAgentMessage(data) {
        const container = document.createElement('div');
        container.className = 'chat-message-container agent';
        
        const messageContent = formatAgentResponse(data);
        
        container.innerHTML = `
            <div class="avatar agent-avatar">
                <i class="fas fa-robot"></i>
            </div>
            <div class="agent-message">
                ${messageContent}
            </div>
        `;
        
        chatWindow.appendChild(container);
        
        // Add quick reply buttons if available
        if (data.type === 'monitor_question' && data.options) {
            addQuickReplyButtons(data.options);
        }
        
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }

    function formatAgentResponse(data) {
        let content = '';

        // Handle error responses
        if (data.error) {
            content += `<div class="error-message" style="background: rgba(239, 68, 68, 0.1); padding: 1rem; border-radius: 8px; border-left: 4px solid #ef4444;">`;
            content += `<h4 style="color: #ef4444; margin-bottom: 0.5rem;"><i class="fas fa-exclamation-triangle"></i> ${data.summary || 'Error'}</h4>`;
            content += `<p style="margin-bottom: 0.75rem;">${data.answer || 'An error occurred'}</p>`;
            if (data.details) {
                content += `<details style="margin-top: 0.75rem; cursor: pointer;">`;
                content += `<summary style="color: #9ca3af; font-size: 0.875rem; margin-bottom: 0.5rem;"><i class="fas fa-info-circle"></i> Show Technical Details</summary>`;
                content += `<pre style="background: #1f2937; padding: 1rem; border-radius: 6px; overflow-x: auto; font-size: 0.813rem; color: #e5e7eb; white-space: pre-wrap; word-wrap: break-word;">${escapeHtml(data.details)}</pre>`;
                content += `</details>`;
            }
            content += `</div>`;
            return content;
        }

        // Type-specific formatting
        if (data.type === 'sre') {
            content += formatSREResponse(data);
        } else if (data.type === 'monitor_create') {
            content += formatMonitorResponse(data);
        } else if (data.type === 'automation') {
            content += formatAutomationResponse(data);
        } else if (data.type === 'knowledge') {
            content += formatKnowledgeResponse(data);
        } else {
            // Generic response
            if (data.summary) content += `<p><strong>Summary:</strong> ${data.summary}</p>`;
            if (data.answer) content += `<p>${data.answer}</p>`;
        }

        // Code blocks
        if (data.code_blocks && data.code_blocks.length > 0) {
            data.code_blocks.forEach(block => {
                content += `<h5 style="color: #60a5fa; margin-top: 1rem;">${block.title}</h5>`;
                content += `<pre><code class="language-${block.language}">${escapeHtml(block.content)}</code></pre>`;
            });
        }

        return content;
    }

    function formatSREResponse(data) {
        let content = '';
        
        if (data.summary) {
            content += `<h4 style="color: #60a5fa;">Analysis Summary</h4>`;
            content += `<p>${data.summary}</p>`;
        }

        if (data.root_cause) {
            content += `<h4 style="color: #f59e0b; margin-top: 1rem;">Root Cause</h4>`;
            content += `<p>${data.root_cause}</p>`;
        }

        if (data.remediation_steps && data.remediation_steps.length > 0) {
            content += `<h4 style="color: #10b981; margin-top: 1rem;">Remediation Steps</h4>`;
            content += `<ol style="margin-left: 1.5rem;">`;
            data.remediation_steps.forEach(step => {
                // Handle both string and object formats
                const stepText = typeof step === 'string' ? step : (step.step || step.description || step.title || JSON.stringify(step));
                content += `<li style="margin-bottom: 0.5rem;">${stepText}</li>`;
            });
            content += `</ol>`;
        }

        return content;
    }

    function formatMonitorResponse(data) {
        let content = '';
        
        if (data.summary) {
            content += `<h4 style="color: #60a5fa;">Monitor Configuration</h4>`;
            content += `<p>${data.summary}</p>`;
        }

        if (data.monitor_config) {
            content += `<h5 style="color: #8b5cf6; margin-top: 1rem;">Configuration Details</h5>`;
            content += `<div style="background: #1f2937; padding: 1rem; border-radius: 8px; margin-top: 0.5rem;">`;
            
            const config = data.monitor_config;
            if (config.metric) content += `<p><strong>Metric:</strong> ${config.metric}</p>`;
            if (config.threshold) content += `<p><strong>Threshold:</strong> ${config.threshold}</p>`;
            if (config.namespace) content += `<p><strong>Namespace:</strong> ${config.namespace}</p>`;
            if (config.aggregation) content += `<p><strong>Aggregation:</strong> ${config.aggregation}</p>`;
            
            content += `</div>`;
        }

        return content;
    }

    function formatAutomationResponse(data) {
        let content = '';
        
        if (data.summary) {
            content += `<h4 style="color: #60a5fa;">Automation Plan</h4>`;
            content += `<p>${data.summary}</p>`;
        }

        if (data.automation_plan) {
            const plan = data.automation_plan;
            
            if (plan.trigger) {
                content += `<h5 style="color: #f59e0b; margin-top: 1rem;">Trigger</h5>`;
                content += `<p>${plan.trigger}</p>`;
            }

            if (plan.actions && plan.actions.length > 0) {
                content += `<h5 style="color: #10b981; margin-top: 1rem;">Actions</h5>`;
                content += `<ol style="margin-left: 1.5rem;">`;
                plan.actions.forEach(action => {
                    content += `<li style="margin-bottom: 0.5rem;">${action}</li>`;
                });
                content += `</ol>`;
            }

            if (plan.approval_required) {
                content += `<div style="background: #7c2d12; border-left: 4px solid #f59e0b; padding: 0.75rem; margin-top: 1rem; border-radius: 4px;">`;
                content += `<p style="color: #fbbf24;"><i class="fas fa-exclamation-triangle"></i> <strong>Approval Required</strong></p>`;
                content += `<p style="color: #fed7aa; font-size: 0.875rem;">This automation requires manual approval before execution.</p>`;
                content += `</div>`;
            }
        }

        return content;
    }

    function formatKnowledgeResponse(data) {
        let content = '';
        
        if (data.answer) {
            content += `<div>${data.answer}</div>`;
        }

        if (data.references && data.references.length > 0) {
            content += `<h5 style="color: #60a5fa; margin-top: 1rem;">References</h5>`;
            content += `<ul style="margin-left: 1.5rem;">`;
            data.references.forEach(ref => {
                content += `<li style="margin-bottom: 0.25rem;">${ref}</li>`;
            });
            content += `</ul>`;
        }

        return content;
    }

    function showLoading() {
        const loadingId = 'loading-' + Date.now();
        const container = document.createElement('div');
        container.id = loadingId;
        container.className = 'chat-message-container agent';
        
        container.innerHTML = `
            <div class="avatar agent-avatar">
                <i class="fas fa-robot"></i>
            </div>
            <div class="agent-message">
                <div class="loading-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;
        
        chatWindow.appendChild(container);
        chatWindow.scrollTop = chatWindow.scrollHeight;
        
        return loadingId;
    }

    function removeLoading(loadingId) {
        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) {
            loadingEl.remove();
        }
    }

    function clearChat() {
        chatWindow.innerHTML = `
            <div class="welcome-message">
                <div class="flex items-start gap-3">
                    <div class="avatar agent-avatar">
                        <i class="fas fa-robot"></i>
                    </div>
                    <div class="flex-1">
                        <div class="agent-message">
                            <h3 class="font-semibold text-purple-400 mb-2">Chat Cleared!</h3>
                            <p>Ready for a new conversation. How can I help you?</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Reset conversation state
        conversationHistory = [];
        pendingMonitorConfig = null;
        
        // Clear from localStorage
        localStorage.removeItem('ai_conversation_history');
        localStorage.removeItem('ai_chat_messages');
        
        updateContextPanel();
    }
    
    function loadConversationFromStorage() {
        try {
            const savedHistory = localStorage.getItem('ai_conversation_history');
            const savedMessages = localStorage.getItem('ai_chat_messages');
            
            if (savedHistory) {
                conversationHistory = JSON.parse(savedHistory);
                console.log(`Loaded ${conversationHistory.length} messages from storage`);
            }
            
            if (savedMessages) {
                chatWindow.innerHTML = ''; // Clear welcome message
                const messages = JSON.parse(savedMessages);
                messages.forEach(msg => {
                    if (msg.role === 'user') {
                        const userDiv = document.createElement('div');
                        userDiv.className = 'user-message-wrapper';
                        userDiv.innerHTML = `
                            <div class="flex items-start gap-3 justify-end">
                                <div class="user-message">
                                    <p>${escapeHtml(msg.content)}</p>
                                </div>
                                <div class="avatar user-avatar">
                                    <i class="fas fa-user"></i>
                                </div>
                            </div>
                        `;
                        chatWindow.appendChild(userDiv);
                    } else if (msg.role === 'assistant') {
                        const response = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content;
                        appendAgentMessage(response, false);
                    }
                });
                chatWindow.scrollTop = chatWindow.scrollHeight;
            }
        } catch (error) {
            console.error('Error loading conversation from storage:', error);
        }
    }
    
    function saveConversationToStorage() {
        try {
            localStorage.setItem('ai_conversation_history', JSON.stringify(conversationHistory));
            
            // Save simplified version for display
            const messages = conversationHistory.map(msg => ({
                role: msg.role,
                content: msg.content
            }));
            localStorage.setItem('ai_chat_messages', JSON.stringify(messages));
            
            // Show save indicator briefly
            const indicator = document.getElementById('save-indicator');
            if (indicator) {
                indicator.style.opacity = '1';
                setTimeout(() => {
                    indicator.style.opacity = '0';
                }, 2000);
            }
        } catch (error) {
            console.error('Error saving conversation to storage:', error);
        }
    }
    
    function exportConversation() {
        if (conversationHistory.length === 0) {
            alert('No conversation to export');
            return;
        }
        
        // Format conversation as readable text
        let exportText = `CloudPulse 360 AI Agent - Conversation Export\n`;
        exportText += `Date: ${new Date().toLocaleString()}\n`;
        exportText += `Agent Mode: ${agentModeNames[activeAgent]}\n`;
        exportText += `\n${'='.repeat(60)}\n\n`;
        
        conversationHistory.forEach((msg, idx) => {
            if (msg.role === 'user') {
                exportText += `User:\n${msg.content}\n\n`;
            } else if (msg.role === 'assistant') {
                try {
                    const response = JSON.parse(msg.content);
                    exportText += `AI Agent:\n${response.answer || response.summary || msg.content}\n\n`;
                } catch {
                    exportText += `AI Agent:\n${msg.content}\n\n`;
                }
            }
        });
        
        // Create download link
        const blob = new Blob([exportText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cloudpulse-conversation-${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function updateContextPanel(data) {
        if (!data || !data.ui_hints) {
            contextSummary.innerHTML = `
                <div class="context-empty">
                    <i class="fas fa-info-circle text-gray-600 text-3xl mb-2"></i>
                    <p class="text-gray-500 text-sm">No context selected</p>
                    <p class="text-gray-600 text-xs mt-2">Context will appear here during analysis</p>
                </div>
            `;
            return;
        }

        let contextHTML = '<div class="space-y-3">';
        
        const hints = data.ui_hints;
        if (hints.resource) {
            contextHTML += `
                <div class="context-item">
                    <h4>Resource</h4>
                    <p>${hints.resource}</p>
                </div>
            `;
        }
        if (hints.metric) {
            contextHTML += `
                <div class="context-item">
                    <h4>Metric</h4>
                    <p>${hints.metric}</p>
                </div>
            `;
        }
        if (hints.threshold) {
            contextHTML += `
                <div class="context-item">
                    <h4>Threshold</h4>
                    <p>${hints.threshold}</p>
                </div>
            `;
        }
        
        contextHTML += '</div>';
        contextSummary.innerHTML = contextHTML;
    }

    async function callAgentApi(prompt, agentType, conversationHistory) {
        const endpoint = '/api/agent/ask';
        
        // Send full conversation history to maintain context
        const body = { 
            prompt: prompt, 
            agentType: agentType,
            conversationHistory: conversationHistory || []
        };

        console.log(`Calling agent API: ${endpoint}`, body);
        console.log(`Conversation history being sent: ${conversationHistory.length} messages`);

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Agent response:', data);
        return data;
    }

    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function addQuickReplyButtons(options) {
        // Remove any existing quick reply buttons
        const existingButtons = document.getElementById('quick-reply-buttons');
        if (existingButtons) {
            existingButtons.remove();
        }

        const container = document.createElement('div');
        container.id = 'quick-reply-buttons';
        container.className = 'chat-message-container agent';
        container.style.marginTop = '0.5rem';
        
        let buttonsHtml = `
            <div class="avatar agent-avatar" style="opacity: 0.5;">
                <i class="fas fa-hand-pointer"></i>
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; max-width: 85%;">
        `;
        
        options.forEach(option => {
            const displayText = typeof option === 'string' ? option : option.label || option.value;
            const value = typeof option === 'string' ? option : option.value;
            
            buttonsHtml += `
                <button class="quick-reply-btn" data-value="${escapeHtml(value)}" 
                    style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); 
                           color: #fff; 
                           border: none; 
                           padding: 0.5rem 1rem; 
                           border-radius: 8px; 
                           cursor: pointer; 
                           font-size: 0.875rem;
                           transition: all 0.2s;
                           white-space: nowrap;">
                    ${escapeHtml(displayText)}
                </button>
            `;
        });
        
        buttonsHtml += `</div>`;
        container.innerHTML = buttonsHtml;
        
        chatWindow.appendChild(container);
        chatWindow.scrollTop = chatWindow.scrollHeight;
        
        // Add click handlers
        container.querySelectorAll('.quick-reply-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const value = btn.dataset.value;
                promptInput.value = value;
                sendMessage();
                container.remove(); // Remove buttons after selection
            });
            
            // Hover effect
            btn.addEventListener('mouseenter', () => {
                btn.style.transform = 'translateY(-2px)';
                btn.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.4)';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.transform = 'translateY(0)';
                btn.style.boxShadow = 'none';
            });
        });
    }

    function showCreateMonitorButton(config) {
        // Check if button already exists
        if (document.getElementById('create-monitor-btn')) return;

        const container = document.createElement('div');
        container.className = 'chat-message-container agent';
        container.style.marginTop = '1rem';
        
        container.innerHTML = `
            <div class="avatar agent-avatar">
                <i class="fas fa-robot"></i>
            </div>
            <div class="agent-message" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border: none;">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem;">
                    <div>
                        <h4 style="color: #fff; margin-bottom: 0.5rem;">✅ Monitor Configuration Complete!</h4>
                        <p style="color: #d1fae5; font-size: 0.875rem;">All details collected. Ready to create this monitor?</p>
                    </div>
                    <button id="create-monitor-btn" style="background: #fff; color: #059669; padding: 0.75rem 1.5rem; border-radius: 8px; border: none; font-weight: 600; cursor: pointer; white-space: nowrap; transition: all 0.2s;">
                        <i class="fas fa-plus-circle" style="margin-right: 0.5rem;"></i>Create Monitor
                    </button>
                </div>
            </div>
        `;
        
        chatWindow.appendChild(container);
        chatWindow.scrollTop = chatWindow.scrollHeight;

        // Add click handler
        document.getElementById('create-monitor-btn').addEventListener('click', () => createMonitor(config));
    }

    async function createMonitor(config) {
        const button = document.getElementById('create-monitor-btn');
        const originalText = button.innerHTML;
        
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right: 0.5rem;"></i>Creating...';

        try {
            const response = await fetch('/api/monitors/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(config),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            // Show success message
            const successContainer = document.createElement('div');
            successContainer.className = 'chat-message-container agent';
            successContainer.style.marginTop = '1rem';
            
            successContainer.innerHTML = `
                <div class="avatar agent-avatar">
                    <i class="fas fa-check-circle"></i>
                </div>
                <div class="agent-message" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border: none; color: #fff;">
                    <h4 style="color: #fff; margin-bottom: 0.5rem;">🎉 Monitor Created Successfully!</h4>
                    <p style="color: #dbeafe;">Monitor ID: <strong>${result.monitorId || result.id}</strong></p>
                    <p style="color: #dbeafe; font-size: 0.875rem; margin-top: 0.5rem;">You can view it in the <a href="/synthetic.html" style="color: #fff; text-decoration: underline;">Synthetic Monitoring</a> dashboard.</p>
                </div>
            `;
            
            chatWindow.appendChild(successContainer);
            chatWindow.scrollTop = chatWindow.scrollHeight;
            
            button.remove();
            pendingMonitorConfig = null;
            
        } catch (error) {
            console.error('Error creating monitor:', error);
            button.disabled = false;
            button.innerHTML = originalText;
            
            appendAgentMessage({
                type: 'error',
                summary: 'Monitor Creation Failed',
                answer: 'Failed to create the monitor. Error: ' + error.message,
                error: true
            });
        }
    }
});
