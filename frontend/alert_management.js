/**
 * Advanced Alert Management System for Cloud Pulse 360
 * Handles multi-channel alerting with email, Slack, webhook notifications
 */

class AlertManager {
    constructor() {
        this.alertConfigurations = [];
        this.alertHistory = [];
        this.notificationChannels = {};
        this.currentTab = 'configurations';
        this.refreshInterval = null;
        
        this.init();
    }
    
    async init() {
        console.log('🚨 Initializing Alert Management System...');
        
        // Initialize event listeners
        this.setupEventListeners();
        
        // Setup tab navigation
        this.setupTabs();
        
        // Load initial data
        await this.loadAlertConfigurations();
        await this.loadAlertHistory();
        
        // Start auto-refresh for alert history
        this.startAutoRefresh();
        
        console.log('✅ Alert Management System initialized');
    }
    
    setupEventListeners() {
        // Create Alert Button
        document.getElementById('create-alert-btn').addEventListener('click', () => {
            this.showCreateAlertModal();
        });
        
        // Modal Controls
        document.getElementById('close-modal').addEventListener('click', () => {
            this.hideCreateAlertModal();
        });
        
        document.getElementById('cancel-alert').addEventListener('click', () => {
            this.hideCreateAlertModal();
        });
        
        // Alert Form
        document.getElementById('alert-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createAlertConfiguration();
        });
        
        // Dynamic Form Controls
        const addNotificationBtn = document.getElementById('add-notification');
        if (addNotificationBtn) {
            addNotificationBtn.addEventListener('click', () => {
                this.addNotificationRow();
            });
        }

        // Advanced Options Toggle
        const advancedToggle = document.getElementById('toggle-advanced-conditions');
        if (advancedToggle) {
            advancedToggle.addEventListener('click', () => {
                this.toggleAdvancedConditions();
            });
        }

        // Warning Threshold Validation
        const criticalInput = document.getElementById('critical-threshold');
        const warningInput = document.getElementById('warning-threshold');
        if (criticalInput && warningInput) {
            const validateThresholds = () => {
                const critical = parseFloat(criticalInput.value);
                const warning = parseFloat(warningInput.value);
                const operator = document.getElementById('threshold-operator')?.value || '>';
                
                if (warning && critical && warning >= critical && (operator === '>' || operator === '>=')) {
                    this.showNotification('Warning threshold should be lower than critical threshold', 'warning');
                }
            };
            
            criticalInput.addEventListener('change', validateThresholds);
            warningInput.addEventListener('change', validateThresholds);
        }
        
        // Test Alert Buttons
        document.getElementById('test-critical-alert').addEventListener('click', () => {
            this.testAlert('critical');
        });
        
        document.getElementById('test-warning-alert').addEventListener('click', () => {
            this.testAlert('warning');
        });
        
        document.getElementById('test-info-alert').addEventListener('click', () => {
            this.testAlert('info');
        });
        
        // Email Configuration
        document.getElementById('email-config-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.configureEmailNotifications();
        });
        
        // Test Slack Button
        document.getElementById('test-slack-btn').addEventListener('click', () => {
            this.testSlackNotification();
        });
        
        // Refresh Button
        document.getElementById('refresh-alerts').addEventListener('click', () => {
            this.refreshAllData();
        });
        
        // Severity Filter
        document.getElementById('severity-filter').addEventListener('change', () => {
            this.filterAlertHistory();
        });
        
        // Clear History Button
        document.getElementById('clear-history-btn').addEventListener('click', () => {
            this.clearAlertHistory();
        });
    }
    
    setupTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabName = button.dataset.tab;
                
                // Update button states
                tabButtons.forEach(btn => {
                    btn.classList.remove('active', 'border-blue-500', 'text-blue-600');
                    btn.classList.add('border-transparent', 'text-gray-500');
                });
                
                button.classList.add('active', 'border-blue-500', 'text-blue-600');
                button.classList.remove('border-transparent', 'text-gray-500');
                
                // Update content visibility
                tabContents.forEach(content => {
                    content.classList.add('hidden');
                });
                
                document.getElementById(`${tabName}-tab`).classList.remove('hidden');
                this.currentTab = tabName;
                
                // Load tab-specific data
                this.onTabChange(tabName);
            });
        });
        
        // Initialize first tab
        this.onTabChange('configurations');
    }
    
    async onTabChange(tabName) {
        switch (tabName) {
            case 'configurations':
                await this.loadAlertConfigurations();
                break;
            case 'history':
                await this.loadAlertHistory();
                break;
            case 'channels':
                this.loadNotificationChannels();
                break;
            case 'test':
                this.setupTestAlerts();
                break;
        }
    }
    
    // Alert Configuration Management
    
    async loadAlertConfigurations() {
        try {
            console.log('📥 Loading alert configurations...');
            
            const response = await fetch('/api/alert-configs');
            const result = await response.json();
            
            if (result.success) {
                this.alertConfigurations = result.data;
                this.renderAlertConfigurations();
                console.log(`✅ Loaded ${result.count} alert configurations`);
            } else {
                throw new Error(result.error);
            }
            
        } catch (error) {
            console.error('❌ Error loading alert configurations:', error);
            this.showNotification('Failed to load alert configurations', 'error');
        }
    }
    
    renderAlertConfigurations() {
        const container = document.getElementById('alert-configurations-list');
        
        if (this.alertConfigurations.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <i class="fas fa-bell-slash text-4xl mb-4"></i>
                    <p class="text-lg">No alert configurations found</p>
                    <p class="text-sm">Create your first alert to get started</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = this.alertConfigurations.map(config => `
            <div class="alert-card bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-all">
                <div class="flex justify-between items-start mb-4">
                    <div class="flex-1">
                        <div class="flex items-center mb-2">
                            <h3 class="text-lg font-semibold text-gray-900 mr-3">${config.name}</h3>
                            <span class="px-2 py-1 text-xs font-medium rounded-full ${config.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
                                ${config.enabled ? 'Enabled' : 'Disabled'}
                            </span>
                        </div>
                        ${config.description ? `<p class="text-gray-600 text-sm mb-3">${config.description}</p>` : ''}
                        
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div>
                                <span class="font-medium text-gray-700">Conditions:</span>
                                <div class="mt-1">
                                    ${config.conditions.map(condition => `
                                        <div class="text-gray-600">${condition.metric} ${condition.operator} ${condition.value}</div>
                                    `).join('')}
                                </div>
                            </div>
                            
                            <div>
                                <span class="font-medium text-gray-700">Notifications:</span>
                                <div class="mt-1 space-y-1">
                                    ${config.notifications.map(notification => `
                                        <div class="flex items-center text-gray-600">
                                            ${this.getNotificationIcon(notification.type)}
                                            <span class="ml-2 capitalize">${notification.type}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                            
                            <div>
                                <span class="font-medium text-gray-700">Stats:</span>
                                <div class="mt-1 text-gray-600">
                                    <div>Triggered: ${config.triggerCount || 0} times</div>
                                    <div>Last: ${config.lastTriggered ? new Date(config.lastTriggered).toLocaleDateString() : 'Never'}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex items-center space-x-2 ml-4">
                        <button class="edit-alert-btn text-blue-600 hover:text-blue-800 p-2" data-id="${config.id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="toggle-alert-btn text-${config.enabled ? 'orange' : 'green'}-600 hover:text-${config.enabled ? 'orange' : 'green'}-800 p-2" 
                                data-id="${config.id}" data-enabled="${config.enabled}">
                            <i class="fas fa-${config.enabled ? 'pause' : 'play'}"></i>
                        </button>
                        <button class="delete-alert-btn text-red-600 hover:text-red-800 p-2" data-id="${config.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
        
        // Add event listeners for action buttons
        this.setupAlertActionListeners();
    }
    
    setupAlertActionListeners() {
        // Edit Alert Buttons
        document.querySelectorAll('.edit-alert-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const alertId = parseInt(e.target.closest('button').dataset.id);
                this.editAlertConfiguration(alertId);
            });
        });
        
        // Toggle Alert Buttons
        document.querySelectorAll('.toggle-alert-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const alertId = parseInt(e.target.closest('button').dataset.id);
                const enabled = e.target.closest('button').dataset.enabled === 'true';
                this.toggleAlertConfiguration(alertId, !enabled);
            });
        });
        
        // Delete Alert Buttons
        document.querySelectorAll('.delete-alert-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const alertId = parseInt(e.target.closest('button').dataset.id);
                this.deleteAlertConfiguration(alertId);
            });
        });
    }
    
    // Alert History Management
    
    async loadAlertHistory() {
        try {
            console.log('📥 Loading alert history...');
            
            const severityFilter = document.getElementById('severity-filter').value;
            const url = severityFilter ? `/api/alert-history?severity=${severityFilter}` : '/api/alert-history';
            
            const response = await fetch(url);
            const result = await response.json();
            
            if (result.success) {
                this.alertHistory = result.data;
                this.renderAlertHistory();
                this.updateActiveAlertsCount();
                console.log(`✅ Loaded ${result.total} alert history entries`);
            } else {
                throw new Error(result.error);
            }
            
        } catch (error) {
            console.error('❌ Error loading alert history:', error);
            this.showNotification('Failed to load alert history', 'error');
        }
    }
    
    renderAlertHistory() {
        const container = document.getElementById('alert-history-list');
        
        if (this.alertHistory.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <i class="fas fa-history text-4xl mb-4"></i>
                    <p class="text-lg">No alert history found</p>
                    <p class="text-sm">Alert history will appear here when alerts are triggered</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = this.alertHistory.map(alert => `
            <div class="alert-card ${alert.severity} bg-white border rounded-lg p-4 fade-in">
                <div class="flex justify-between items-start">
                    <div class="flex-1">
                        <div class="flex items-center mb-2">
                            <span class="severity-badge ${alert.severity} text-white px-2 py-1 text-xs font-bold rounded-full mr-3">
                                ${this.getSeverityIcon(alert.severity)} ${alert.severity.toUpperCase()}
                            </span>
                            <h4 class="text-lg font-semibold text-gray-900">${alert.name}</h4>
                        </div>
                        
                        <p class="text-gray-700 mb-3">${alert.message}</p>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                                <span class="font-medium text-gray-700">Timestamp:</span>
                                <div class="text-gray-600">${new Date(alert.timestamp).toLocaleString()}</div>
                            </div>
                            
                            <div>
                                <span class="font-medium text-gray-700">Source:</span>
                                <div class="text-gray-600">${alert.source}</div>
                            </div>
                        </div>
                        
                        ${alert.notifications && alert.notifications.length > 0 ? `
                            <div class="mt-3">
                                <span class="font-medium text-gray-700 text-sm">Notifications Sent:</span>
                                <div class="mt-1 flex space-x-2">
                                    ${alert.notifications.map(notification => `
                                        <span class="inline-flex items-center px-2 py-1 text-xs rounded ${notification.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                                            ${this.getNotificationIcon(notification.type)}
                                            <span class="ml-1 capitalize">${notification.type}</span>
                                            <i class="fas fa-${notification.status === 'success' ? 'check' : 'times'} ml-1"></i>
                                        </span>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `).join('');
    }
    
    updateActiveAlertsCount() {
        const criticalAlerts = this.alertHistory.filter(alert => 
            alert.severity === 'critical' && 
            Date.now() - new Date(alert.timestamp).getTime() < 24 * 60 * 60 * 1000 // Last 24 hours
        ).length;
        
        const countElement = document.getElementById('active-alerts-count');
        countElement.innerHTML = `
            <i class="fas fa-exclamation-triangle mr-1"></i>
            ${criticalAlerts} Active Alerts
        `;
        
        if (criticalAlerts > 0) {
            countElement.classList.add('pulse-animation');
        } else {
            countElement.classList.remove('pulse-animation');
        }
    }
    
    // Modal Management
    
    showCreateAlertModal() {
        document.getElementById('create-alert-modal').classList.remove('hidden');
        this.resetAlertForm();
    }
    
    hideCreateAlertModal() {
        document.getElementById('create-alert-modal').classList.add('hidden');
    }
    
    resetAlertForm() {
        document.getElementById('alert-form').reset();
        
        // Reset conditions to one row
        const conditionsContainer = document.getElementById('conditions-container');
        conditionsContainer.innerHTML = `
            <div class="condition-row flex space-x-3 items-center">
                <select class="condition-metric border border-gray-300 rounded-lg px-3 py-2 flex-1">
                    <option value="CPUUtilization">CPU Utilization</option>
                    <option value="NetworkIn">Network In</option>
                    <option value="NetworkOut">Network Out</option>
                    <option value="DiskReadBytes">Disk Read</option>
                    <option value="DiskWriteBytes">Disk Write</option>
                </select>
                <select class="condition-operator border border-gray-300 rounded-lg px-3 py-2">
                    <option value=">">Greater than</option>
                    <option value=">=">Greater than or equal</option>
                    <option value="<">Less than</option>
                    <option value="<=">Less than or equal</option>
                    <option value="==">Equals</option>
                    <option value="!=">Not equals</option>
                </select>
                <input type="number" class="condition-value border border-gray-300 rounded-lg px-3 py-2 w-24" placeholder="80" step="0.01">
                <button type="button" class="remove-condition text-red-500 hover:text-red-700">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        
        // Reset notifications to one row
        this.resetNotificationsContainer();
        this.setupDynamicFormListeners();
    }
    
    resetNotificationsContainer() {
        const notificationsContainer = document.getElementById('notifications-container');
        notificationsContainer.innerHTML = `
            <div class="notification-row border border-gray-200 rounded-lg p-4">
                <div class="flex items-center justify-between mb-3">
                    <select class="notification-type border border-gray-300 rounded-lg px-3 py-2">
                        <option value="email">Email</option>
                        <option value="slack">Slack</option>
                        <option value="webhook">Webhook</option>
                        <option value="teams">Microsoft Teams</option>
                    </select>
                    <button type="button" class="remove-notification text-red-500 hover:text-red-700">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                <div class="notification-config">
                    ${this.getNotificationConfigHTML('email')}
                </div>
            </div>
        `;
    }
    
    setupDynamicFormListeners() {
        // Remove condition listeners
        document.querySelectorAll('.remove-condition').forEach(button => {
            button.addEventListener('click', (e) => {
                const conditionsContainer = document.getElementById('conditions-container');
                if (conditionsContainer.children.length > 1) {
                    e.target.closest('.condition-row').remove();
                }
            });
        });
        
        // Remove notification listeners
        document.querySelectorAll('.remove-notification').forEach(button => {
            button.addEventListener('click', (e) => {
                const notificationsContainer = document.getElementById('notifications-container');
                if (notificationsContainer.children.length > 1) {
                    e.target.closest('.notification-row').remove();
                }
            });
        });
        
        // Notification type change listeners
        document.querySelectorAll('.notification-type').forEach(select => {
            select.addEventListener('change', (e) => {
                const configContainer = e.target.closest('.notification-row').querySelector('.notification-config');
                configContainer.innerHTML = this.getNotificationConfigHTML(e.target.value);
            });
        });
    }
    
    addConditionRow() {
        const conditionsContainer = document.getElementById('conditions-container');
        const newRow = document.createElement('div');
        newRow.className = 'condition-row flex space-x-3 items-center';
        newRow.innerHTML = `
            <select class="condition-metric border border-gray-300 rounded-lg px-3 py-2 flex-1">
                <option value="CPUUtilization">CPU Utilization</option>
                <option value="NetworkIn">Network In</option>
                <option value="NetworkOut">Network Out</option>
                <option value="DiskReadBytes">Disk Read</option>
                <option value="DiskWriteBytes">Disk Write</option>
            </select>
            <select class="condition-operator border border-gray-300 rounded-lg px-3 py-2">
                <option value=">">Greater than</option>
                <option value=">=">Greater than or equal</option>
                <option value="<">Less than</option>
                <option value="<=">Less than or equal</option>
                <option value="==">Equals</option>
                <option value="!=">Not equals</option>
            </select>
            <input type="number" class="condition-value border border-gray-300 rounded-lg px-3 py-2 w-24" placeholder="80" step="0.01">
            <button type="button" class="remove-condition text-red-500 hover:text-red-700">
                <i class="fas fa-trash"></i>
            </button>
        `;
        
        conditionsContainer.appendChild(newRow);
        this.setupDynamicFormListeners();
    }
    
    addNotificationRow() {
        const notificationsContainer = document.getElementById('notifications-container');
        const newRow = document.createElement('div');
        newRow.className = 'notification-row border border-gray-200 rounded-lg p-4';
        newRow.innerHTML = `
            <div class="flex items-center justify-between mb-3">
                <select class="notification-type border border-gray-300 rounded-lg px-3 py-2">
                    <option value="email">Email</option>
                    <option value="slack">Slack</option>
                    <option value="webhook">Webhook</option>
                    <option value="teams">Microsoft Teams</option>
                </select>
                <button type="button" class="remove-notification text-red-500 hover:text-red-700">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <div class="notification-config">
                ${this.getNotificationConfigHTML('email')}
            </div>
        `;
        
        notificationsContainer.appendChild(newRow);
        this.setupDynamicFormListeners();
    }
    
    getNotificationConfigHTML(type) {
        switch (type) {
            case 'email':
                return `
                    <div class="space-y-3">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Recipients *</label>
                            <input type="text" class="notification-recipients w-full border border-gray-300 rounded-lg px-3 py-2" 
                                   placeholder="user@example.com, admin@example.com" required>
                            <p class="text-xs text-gray-500 mt-1">Comma-separated email addresses</p>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">From Address</label>
                            <input type="email" class="notification-from w-full border border-gray-300 rounded-lg px-3 py-2" 
                                   placeholder="alerts@yourcompany.com">
                        </div>
                    </div>
                `;
                
            case 'slack':
                return `
                    <div class="space-y-3">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Webhook URL *</label>
                            <input type="url" class="notification-webhook w-full border border-gray-300 rounded-lg px-3 py-2" 
                                   placeholder="https://hooks.slack.com/services/..." required>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Channel</label>
                            <input type="text" class="notification-channel w-full border border-gray-300 rounded-lg px-3 py-2" 
                                   placeholder="#alerts">
                        </div>
                    </div>
                `;
                
            case 'webhook':
                return `
                    <div class="space-y-3">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Webhook URL *</label>
                            <input type="url" class="notification-webhook w-full border border-gray-300 rounded-lg px-3 py-2" 
                                   placeholder="https://your-server.com/webhook" required>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Timeout (seconds)</label>
                            <input type="number" class="notification-timeout w-full border border-gray-300 rounded-lg px-3 py-2" 
                                   placeholder="30" value="30" min="5" max="300">
                        </div>
                    </div>
                `;
                
            case 'teams':
                return `
                    <div class="space-y-3">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Webhook URL *</label>
                            <input type="url" class="notification-webhook w-full border border-gray-300 rounded-lg px-3 py-2" 
                                   placeholder="https://outlook.office.com/webhook/..." required>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Team Name</label>
                            <input type="text" class="notification-team w-full border border-gray-300 rounded-lg px-3 py-2" 
                                   placeholder="DevOps Team">
                        </div>
                    </div>
                `;
                
            default:
                return '<p class="text-gray-500">Select a notification type</p>';
        }
    }
    
    // Form Processing
    
    async createAlertConfiguration() {
        try {
            const formData = this.collectAlertFormData();
            
            if (!this.validateAlertFormData(formData)) {
                return;
            }
            
            console.log('📝 Creating alert configuration:', formData.name);
            
            const response = await fetch('/api/alert-configs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showNotification(`Alert "${formData.name}" created successfully!`, 'success');
                this.hideCreateAlertModal();
                await this.loadAlertConfigurations();
            } else {
                throw new Error(result.error);
            }
            
        } catch (error) {
            console.error('❌ Error creating alert configuration:', error);
            this.showNotification(`Failed to create alert: ${error.message}`, 'error');
        }
    }
    
    collectAlertFormData() {
        const name = document.getElementById('alert-name').value.trim();
        const description = document.getElementById('alert-description').value.trim();
        const enabled = document.getElementById('alert-enabled').checked;
        
        // Collect metric and conditions
        const metric = document.getElementById('alert-metric')?.value;
        const operator = document.getElementById('threshold-operator')?.value || '>';
        const criticalThreshold = parseFloat(document.getElementById('critical-threshold')?.value);
        const warningThreshold = parseFloat(document.getElementById('warning-threshold')?.value);
        
        // Collect evaluation settings
        const evaluationWindow = parseInt(document.getElementById('evaluation-window')?.value) || 5;
        const dataPoints = document.getElementById('data-points')?.value || '1/1';
        
        // Collect advanced options
        const alertNoData = document.getElementById('alert-no-data')?.checked || false;
        const autoResolve = document.getElementById('auto-resolve')?.checked || false;
        const recoveryThreshold = parseFloat(document.getElementById('recovery-threshold')?.value);
        
        // Collect notifications
        const notifications = [];
        document.querySelectorAll('.notification-row').forEach(row => {
            const type = row.querySelector('.notification-type').value;
            const config = this.collectNotificationConfig(row, type);
            
            if (config) {
                notifications.push({ type, config });
            }
        });
        
        // Collect notification settings
        const notificationFrequency = document.getElementById('notification-frequency')?.value || 'once';
        const notifyRecovery = document.getElementById('notify-recovery')?.checked || false;
        
        // Collect message templates
        const titleTemplate = document.getElementById('alert-title-template')?.value.trim();
        const messageTemplate = document.getElementById('alert-message-template')?.value.trim();
        const recoveryTemplate = document.getElementById('recovery-message-template')?.value.trim();
        
        // Collect priority and tags
        const priority = document.getElementById('alert-priority')?.value || 'P2';
        const environment = document.getElementById('alert-environment')?.value;
        const tags = document.getElementById('alert-tags')?.value.trim();
        
        return {
            name,
            description,
            metric,
            conditions: {
                operator,
                criticalThreshold,
                warningThreshold: warningThreshold || null,
                evaluationWindow,
                dataPoints,
                alertNoData,
                autoResolve,
                recoveryThreshold: recoveryThreshold || null
            },
            notifications,
            notificationSettings: {
                frequency: notificationFrequency,
                notifyRecovery
            },
            messageTemplates: {
                title: titleTemplate,
                message: messageTemplate,
                recovery: recoveryTemplate
            },
            metadata: {
                priority,
                environment,
                tags: tags ? tags.split(',').map(t => t.trim()) : []
            },
            enabled,
            createdAt: new Date().toISOString()
        };
    }
    
    collectNotificationConfig(row, type) {
        switch (type) {
            case 'email':
                const recipients = row.querySelector('.notification-recipients')?.value.trim();
                const from = row.querySelector('.notification-from')?.value.trim();
                
                if (!recipients) return null;
                
                return {
                    recipients: recipients.split(',').map(email => email.trim()).filter(email => email),
                    from: from || undefined
                };
                
            case 'slack':
                const slackWebhook = row.querySelector('.notification-webhook')?.value.trim();
                const channel = row.querySelector('.notification-channel')?.value.trim();
                
                if (!slackWebhook) return null;
                
                return {
                    webhookUrl: slackWebhook,
                    channel: channel || undefined
                };
                
            case 'webhook':
                const webhookUrl = row.querySelector('.notification-webhook')?.value.trim();
                const timeout = parseInt(row.querySelector('.notification-timeout')?.value);
                
                if (!webhookUrl) return null;
                
                return {
                    url: webhookUrl,
                    timeout: timeout || 30
                };
                
            case 'teams':
                const teamsWebhook = row.querySelector('.notification-webhook')?.value.trim();
                const team = row.querySelector('.notification-team')?.value.trim();
                
                if (!teamsWebhook) return null;
                
                return {
                    webhookUrl: teamsWebhook,
                    team: team || undefined
                };
                
            default:
                return null;
        }
    }
    
    validateAlertFormData(formData) {
        if (!formData.name) {
            this.showNotification('Alert name is required', 'error');
            return false;
        }
        
        if (formData.conditions.length === 0) {
            this.showNotification('At least one condition is required', 'error');
            return false;
        }
        
        if (formData.notifications.length === 0) {
            this.showNotification('At least one notification channel is required', 'error');
            return false;
        }
        
        return true;
    }
    
    // Alert Testing
    
    async testAlert(severity) {
        try {
            console.log(`🧪 Testing ${severity} alert...`);
            
            const testMessage = this.generateTestMessage(severity);
            
            // Test with a sample configuration (you can modify this)
            const testConfig = {
                type: 'webhook',
                config: {
                    url: 'https://httpbin.org/post'
                }
            };
            
            const response = await fetch('/api/test-notification', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type: testConfig.type,
                    config: testConfig.config,
                    message: testMessage
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showTestResult(`${severity} alert test completed successfully`, 'success');
            } else {
                throw new Error(result.error);
            }
            
        } catch (error) {
            console.error(`❌ Error testing ${severity} alert:`, error);
            this.showTestResult(`${severity} alert test failed: ${error.message}`, 'error');
        }
    }
    
    generateTestMessage(severity) {
        const messages = {
            critical: 'CRITICAL: CPU utilization has reached 95% on production server',
            warning: 'WARNING: Memory usage is above 80% threshold',
            info: 'INFO: Scheduled maintenance window starting in 1 hour'
        };
        
        return messages[severity] || 'Test alert message';
    }
    
    showTestResult(message, type) {
        const resultsContainer = document.getElementById('test-results');
        const timestamp = new Date().toLocaleTimeString();
        
        resultsContainer.innerHTML = `
            <div class="flex items-center text-${type === 'success' ? 'green' : 'red'}-600 mb-2">
                <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'} mr-2"></i>
                <span class="font-medium">[${timestamp}] ${message}</span>
            </div>
            ${resultsContainer.innerHTML}
        `;
    }
    
    // Configuration Management
    
    async configureEmailNotifications() {
        try {
            const host = document.getElementById('email-host').value.trim();
            const port = parseInt(document.getElementById('email-port').value);
            const secure = document.getElementById('email-secure').checked;
            const user = document.getElementById('email-user').value.trim();
            const password = document.getElementById('email-password').value;
            
            if (!host || !port || !user || !password) {
                this.showNotification('All email fields are required', 'error');
                return;
            }
            
            console.log('📧 Configuring email notifications...');
            
            const response = await fetch('/api/configure-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    host,
                    port,
                    secure,
                    user,
                    password
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showNotification('Email configuration saved successfully!', 'success');
            } else {
                throw new Error(result.error);
            }
            
        } catch (error) {
            console.error('❌ Error configuring email:', error);
            this.showNotification(`Failed to configure email: ${error.message}`, 'error');
        }
    }
    
    async testSlackNotification() {
        try {
            const webhookUrl = document.getElementById('slack-webhook').value.trim();
            const channel = document.getElementById('slack-channel').value.trim();
            
            if (!webhookUrl) {
                this.showNotification('Slack webhook URL is required', 'error');
                return;
            }
            
            console.log('💬 Testing Slack notification...');
            
            const response = await fetch('/api/test-notification', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type: 'slack',
                    config: {
                        webhookUrl,
                        channel
                    },
                    message: 'Test notification from Cloud Pulse 360 Alert Management System'
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showNotification('Slack test notification sent successfully!', 'success');
            } else {
                throw new Error(result.error);
            }
            
        } catch (error) {
            console.error('❌ Error testing Slack notification:', error);
            this.showNotification(`Slack test failed: ${error.message}`, 'error');
        }
    }
    
    // Utility Functions
    
    async toggleAlertConfiguration(alertId, enabled) {
        try {
            console.log(`🔄 ${enabled ? 'Enabling' : 'Disabling'} alert ${alertId}...`);
            
            const response = await fetch(`/api/alert-configs/${alertId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ enabled })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showNotification(`Alert ${enabled ? 'enabled' : 'disabled'} successfully!`, 'success');
                await this.loadAlertConfigurations();
            } else {
                throw new Error(result.error);
            }
            
        } catch (error) {
            console.error('❌ Error toggling alert:', error);
            this.showNotification(`Failed to toggle alert: ${error.message}`, 'error');
        }
    }
    
    async deleteAlertConfiguration(alertId) {
        if (!confirm('Are you sure you want to delete this alert configuration?')) {
            return;
        }
        
        try {
            console.log(`🗑️ Deleting alert ${alertId}...`);
            
            const response = await fetch(`/api/alert-configs/${alertId}`, {
                method: 'DELETE'
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showNotification('Alert configuration deleted successfully!', 'success');
                await this.loadAlertConfigurations();
            } else {
                throw new Error(result.error);
            }
            
        } catch (error) {
            console.error('❌ Error deleting alert:', error);
            this.showNotification(`Failed to delete alert: ${error.message}`, 'error');
        }
    }
    
    async refreshAllData() {
        console.log('🔄 Refreshing all alert data...');
        await Promise.all([
            this.loadAlertConfigurations(),
            this.loadAlertHistory()
        ]);
        this.showNotification('Data refreshed successfully!', 'success');
    }
    
    async filterAlertHistory() {
        await this.loadAlertHistory();
    }
    
    async clearAlertHistory() {
        if (!confirm('Are you sure you want to clear all alert history? This action cannot be undone.')) {
            return;
        }
        
        // Note: You would implement this endpoint in the backend
        console.log('🧹 Clear history functionality would be implemented here');
        this.showNotification('Clear history functionality not yet implemented', 'info');
    }
    
    startAutoRefresh() {
        // Refresh alert history every 30 seconds
        this.refreshInterval = setInterval(async () => {
            if (this.currentTab === 'history') {
                await this.loadAlertHistory();
            }
        }, 30000);
    }
    
    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }
    
    getNotificationIcon(type) {
        const icons = {
            email: '<i class="fas fa-envelope notification-type-icon"></i>',
            slack: '<i class="fab fa-slack notification-type-icon"></i>',
            webhook: '<i class="fas fa-link notification-type-icon"></i>',
            teams: '<i class="fab fa-microsoft notification-type-icon"></i>'
        };
        
        return icons[type] || '<i class="fas fa-bell notification-type-icon"></i>';
    }
    
    getSeverityIcon(severity) {
        const icons = {
            critical: '🔴',
            warning: '🟡',
            info: '🔵'
        };
        
        return icons[severity] || '⚪';
    }
    
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 z-50 max-w-sm bg-white border-l-4 shadow-lg rounded-lg p-4 transition-all transform translate-x-full`;
        
        const colors = {
            success: 'border-green-500',
            error: 'border-red-500',
            warning: 'border-orange-500',
            info: 'border-blue-500'
        };
        
        const icons = {
            success: 'fa-check-circle text-green-500',
            error: 'fa-exclamation-circle text-red-500',
            warning: 'fa-exclamation-triangle text-orange-500',
            info: 'fa-info-circle text-blue-500'
        };
        
        notification.classList.add(colors[type]);
        notification.innerHTML = `
            <div class="flex items-center">
                <i class="fas ${icons[type]} mr-3"></i>
                <div class="flex-1">
                    <p class="text-sm font-medium text-gray-900">${message}</p>
                </div>
                <button class="ml-3 text-gray-400 hover:text-gray-600" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.classList.remove('translate-x-full');
        }, 100);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.classList.add('translate-x-full');
                setTimeout(() => notification.remove(), 300);
            }
        }, 5000);
    }
    
    // Cleanup
    destroy() {
        this.stopAutoRefresh();
    }
}

// Initialize Alert Management System
document.addEventListener('DOMContentLoaded', () => {
    window.alertManager = new AlertManager();
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (window.alertManager) {
        window.alertManager.destroy();
    }
});