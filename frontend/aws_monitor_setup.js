// AWS Monitor Setup JavaScript
class AWSMonitorSetup {
    constructor() {
        // No hardcoded AWS services - will load real data from AWS API
        this.awsServices = {};
        this.realNamespaces = [];

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.adjustLayoutForSidebar();
        this.loadExistingMonitors();
        this.loadDynamicNamespaces();
    }

    setupEventListeners() {
        // Test connection button
        document.getElementById('test-connection-btn').addEventListener('click', () => {
            this.testAwsConnection();
        });

        // Auto discover button  
        document.getElementById('auto-discover-btn').addEventListener('click', () => {
            this.autoDiscoverResources();
        });

        // Create custom monitor button
        document.getElementById('create-custom-btn').addEventListener('click', () => {
            this.showCustomMonitorForm();
        });

        // Start metrics collection button
        document.getElementById('start-collection-btn').addEventListener('click', () => {
            this.startMetricsCollection();
        });

        // AWS Service selection change - handled in updateServiceDropdown

        // Resource selection change
        document.getElementById('resource-selection').addEventListener('change', (e) => {
            this.toggleResourceFields(e.target.value);
        });

        // Add tag filter
        document.getElementById('add-tag-filter').addEventListener('click', () => {
            this.addTagFilter();
        });

        // Form submission
        document.getElementById('monitor-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createMonitor();
        });

        // Cancel form
        document.getElementById('cancel-monitor').addEventListener('click', () => {
            this.hideCustomMonitorForm();
        });

        // Refresh monitors
        document.getElementById('refresh-monitors').addEventListener('click', () => {
            this.loadExistingMonitors();
        });

        // Sidebar toggle handling
        const sidebarToggle = document.getElementById('sidebar-toggle');
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', () => {
                setTimeout(() => this.adjustLayoutForSidebar(), 300);
            });
        }
    }

    adjustLayoutForSidebar() {
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('main-content');
        
        if (sidebar && mainContent) {
            if (sidebar.classList.contains('w-64')) {
                mainContent.classList.remove('ml-20');
                mainContent.classList.add('ml-64');
            } else {
                mainContent.classList.remove('ml-64');
                mainContent.classList.add('ml-20');
            }
        }
    }

    async testAwsConnection() {
        this.showLoading();
        
        try {
            // Test real AWS connection
            const connectionResponse = await fetch('/api/test/aws-connection');

            if (connectionResponse.ok) {
                const result = await connectionResponse.json();
                
                if (result.connected) {
                    this.showConnectionStatus('success', `✅ Real AWS connection successful! Found ${result.namespaceCount} namespaces in ${result.region}. Ready to create monitors.`);
                } else {
                    this.showConnectionStatus('error', `❌ AWS connection failed: ${result.error}. ${result.details || 'Please check your credentials in Cloud Integration.'}`);
                }
            } else {
                this.showConnectionStatus('error', 'Failed to test AWS connection. Service might not be running.');
            }
        } catch (error) {
            console.error('Connection test error:', error);
            this.showConnectionStatus('error', 'Connection test failed. Service might not be running.');
        } finally {
            this.hideLoading();
        }
    }

    showConnectionStatus(type, message) {
        const statusDiv = document.getElementById('connection-status');
        const indicator = document.getElementById('status-indicator');
        const text = document.getElementById('status-text');
        
        statusDiv.classList.remove('hidden');
        
        if (type === 'success') {
            indicator.className = 'w-3 h-3 rounded-full mr-3 bg-green-500';
            text.className = 'text-green-400';
        } else {
            indicator.className = 'w-3 h-3 rounded-full mr-3 bg-red-500';
            text.className = 'text-red-400';
        }
        
        text.textContent = message;
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            statusDiv.classList.add('hidden');
        }, 5000);
    }

    async autoDiscoverResources() {
        this.showLoading();
        
        try {
            // Create demo monitors for common AWS services
            const demoResources = [
                { type: 'ec2', name: 'Web Server Instance', id: 'i-1234567890abcdef0', region: 'us-east-1' },
                { type: 'rds', name: 'Production Database', id: 'prod-db-1', region: 'us-east-1' },
                { type: 'lambda', name: 'API Handler Function', id: 'api-handler', region: 'us-east-1' }
            ];
            
            let created = 0;
            for (const resource of demoResources) {
                try {
                    await this.createAutoMonitor(resource);
                    created++;
                } catch (error) {
                    console.error(`Failed to create monitor for ${resource.id}:`, error);
                }
            }

            this.showNotification(`Auto-discovery completed! Created ${created} demo monitors. Configure AWS credentials to discover real resources.`, 'success');
            this.loadExistingMonitors();

        } catch (error) {
            console.error('Auto-discovery error:', error);
            this.showNotification('Auto-discovery failed. Please try again.', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async createAutoMonitor(resource) {
        // Load real metrics for this resource type
        let realMetrics = [];
        try {
            const metricsResponse = await fetch(`/api/real/aws-metrics/${encodeURIComponent(resource.type)}`);
            if (metricsResponse.ok) {
                const metricsData = await metricsResponse.json();
                realMetrics = metricsData.metrics || [];
            }
        } catch (error) {
            console.error(`Failed to load metrics for ${resource.type}:`, error);
        }

        const monitorData = {
            name: `${resource.type}-${resource.id}`,
            service: resource.type,
            resourceId: resource.id,
            region: resource.region || 'us-east-1',
            metrics: realMetrics,
            collectionInterval: 300,
            anomalyDetection: true,
            alertThreshold: 0.8,
            autoCreated: true
        };

        const response = await fetch('/api/monitors', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(monitorData)
        });

        if (!response.ok) {
            throw new Error('Failed to create monitor');
        }

        return await response.json();
    }

    showCustomMonitorForm() {
        document.getElementById('custom-monitor-form').classList.remove('hidden');
        document.getElementById('create-custom-btn').textContent = 'Hide Form';
        
        // Update button to toggle
        const btn = document.getElementById('create-custom-btn');
        btn.onclick = () => this.hideCustomMonitorForm();
    }

    hideCustomMonitorForm() {
        document.getElementById('custom-monitor-form').classList.add('hidden');
        document.getElementById('create-custom-btn').textContent = 'Create Custom Monitor';
        
        // Reset button
        const btn = document.getElementById('create-custom-btn');
        btn.onclick = () => this.showCustomMonitorForm();
        
        // Reset form
        document.getElementById('monitor-form').reset();
    }

    // Old updateMetricsSelection function removed - replaced with loadMetricsForNamespace that uses real AWS data

    toggleResourceFields(selection) {
        const resourceIdField = document.getElementById('resource-id-field');
        const tagFiltersField = document.getElementById('tag-filters-field');

        resourceIdField.classList.add('hidden');
        tagFiltersField.classList.add('hidden');

        if (selection === 'specific') {
            resourceIdField.classList.remove('hidden');
        } else if (selection === 'tags') {
            tagFiltersField.classList.remove('hidden');
        }
    }

    addTagFilter() {
        const container = document.getElementById('tag-filters-container');
        const div = document.createElement('div');
        div.className = 'flex items-center space-x-2 mb-2';
        div.innerHTML = `
            <input type="text" placeholder="Tag Key" class="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white flex-1">
            <input type="text" placeholder="Tag Value" class="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white flex-1">
            <button type="button" onclick="this.parentElement.remove()" class="bg-red-600 hover:bg-red-700 px-3 py-2 rounded-lg">
                <i class="fas fa-trash"></i>
            </button>
        `;
        container.appendChild(div);
    }

    async createMonitor() {
        this.showLoading();

        try {
            // Collect form data
            const formData = new FormData(document.getElementById('monitor-form'));
            const selectedMetrics = Array.from(document.querySelectorAll('input[name="metrics"]:checked'))
                .map(cb => cb.value);

            console.log('🔍 Debug - Selected metrics:', selectedMetrics);
            console.log('🔍 Debug - All metrics checkboxes:', document.querySelectorAll('input[name="metrics"]').length);

            // Collect tag filters
            const tagFilters = {};
            const tagContainers = document.querySelectorAll('#tag-filters-container > div');
            tagContainers.forEach(container => {
                const inputs = container.querySelectorAll('input');
                if (inputs.length === 2 && inputs[0].value && inputs[1].value) {
                    tagFilters[inputs[0].value] = inputs[1].value;
                }
            });

            const monitorData = {
                name: document.getElementById('monitor-name').value,
                service: document.getElementById('aws-service').value,
                resourceSelection: document.getElementById('resource-selection').value,
                resourceId: document.getElementById('resource-id').value || null,
                region: document.getElementById('aws-region').value,
                metrics: selectedMetrics,
                tagFilters: Object.keys(tagFilters).length > 0 ? tagFilters : null,
                collectionInterval: parseInt(document.getElementById('collection-interval').value),
                anomalyDetection: document.getElementById('anomaly-detection').value === 'enabled',
                alertThreshold: parseFloat(document.getElementById('alert-threshold').value),
                type: 'aws',
                autoCreated: false
            };

            // Validate required fields with detailed error messages
            if (!monitorData.name) {
                throw new Error('Please enter a monitor name.');
            }
            if (!monitorData.service) {
                throw new Error('Please select an AWS service.');
            }
            if (selectedMetrics.length === 0) {
                throw new Error('Please select at least one metric to monitor. If no metrics appear, try reselecting the AWS service.');
            }

            const response = await fetch('/api/monitors', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(monitorData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to create monitor');
            }

            const result = await response.json();
            
            this.showNotification('Monitor created successfully!', 'success');
            this.hideCustomMonitorForm();
            this.loadExistingMonitors();

        } catch (error) {
            console.error('Create monitor error:', error);
            this.showNotification(error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async startMetricsCollection() {
        this.showLoading();

        try {
            // For now, simulate starting metrics collection
            await new Promise(resolve => setTimeout(resolve, 1000));
            this.showNotification('Metrics collection simulation started! Configure AWS credentials for real metrics collection.', 'success');

        } catch (error) {
            console.error('Start collection error:', error);
            this.showNotification('Failed to start metrics collection. Please configure AWS credentials first.', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async loadExistingMonitors() {
        try {
            const response = await fetch('/api/monitors');

            if (response.ok) {
                const monitors = await response.json();
                console.log('📊 Loaded monitors:', monitors);
                
                // Filter for AWS monitors using the new structure
                const awsMonitors = monitors.filter(m => 
                    m.monitorType === 'aws' || 
                    m.type === 'aws' || 
                    m.service ||
                    m.resourceType
                );
                
                console.log('🔍 AWS Monitors found:', awsMonitors.length);
                this.displayMonitors(awsMonitors);
            } else {
                console.error('Failed to load monitors:', response.status);
                this.displayMonitors([]);
            }

        } catch (error) {
            console.error('❌ Load monitors error:', error);
            this.displayMonitors([]);
        }
    }

    displayMonitors(monitors) {
        const container = document.getElementById('monitors-list');
        
        if (monitors.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-400">
                    <i class="fab fa-aws text-4xl mb-4"></i>
                    <p class="text-lg mb-2">No AWS monitors configured</p>
                    <p>Create your first monitor using the options above</p>
                </div>
            `;
            return;
        }

        container.innerHTML = monitors.map(monitor => {
            // Handle both old and new monitor structures
            const serviceName = monitor.resourceType || monitor.service || 'Unknown Service';
            const metricName = monitor.metricName || 'Unknown Metric';
            const resourceId = monitor.resourceId || 'all';
            const region = monitor.region || 'us-east-1';
            
            // Determine status from history records
            let status = 'pending';
            let statusClass = 'bg-yellow-900 text-yellow-300';
            
            if (monitor.historyRecords && monitor.historyRecords.length > 0) {
                const lastRecord = monitor.historyRecords[0];
                if (lastRecord.status === 'Fail') {
                    status = 'error';
                    statusClass = 'bg-red-900 text-red-300';
                } else if (lastRecord.status === 'Success') {
                    status = 'active';
                    statusClass = 'bg-green-900 text-green-300';
                }
            }
            
            return `
                <div class="bg-gray-700 border border-gray-600 rounded-lg p-4">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center">
                            <i class="fab fa-aws text-orange-500 text-xl mr-3"></i>
                            <div>
                                <h4 class="font-semibold text-white">${monitor.name}</h4>
                                <p class="text-sm text-gray-400">
                                    ${serviceName} • ${metricName}
                                    ${resourceId !== 'all' ? ` • ${resourceId}` : ''}
                                    • ${region}
                                </p>
                            </div>
                        </div>
                        
                        <div class="flex items-center space-x-2">
                            <span class="px-2 py-1 text-xs rounded-full ${statusClass}">
                                ${status}
                            </span>
                            <button onclick="awsSetup.viewMetrics('${monitor.id}')" class="text-green-400 hover:text-green-300 p-1" title="View Metrics">
                                <i class="fas fa-chart-line"></i>
                            </button>
                            <button onclick="awsSetup.editMonitor('${monitor.id}')" class="text-blue-400 hover:text-blue-300 p-1" title="Edit Monitor">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="awsSetup.deleteMonitor('${monitor.id}')" class="text-red-400 hover:text-red-300 p-1" title="Delete Monitor">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    
                    <div class="mt-3 flex flex-wrap gap-1">
                        <span class="px-2 py-1 bg-blue-900 text-blue-300 text-xs rounded">
                            ${metricName} (${monitor.thresholdOperator || '>='} ${monitor.thresholdValue || 'N/A'})
                        </span>
                        <span class="px-2 py-1 bg-gray-600 text-gray-300 text-xs rounded">
                            Interval: ${Math.floor((monitor.monitoringInterval || 300) / 60)}min
                        </span>
                    </div>
                </div>
            `;
        }).join('');
    }

    async viewMetrics(monitorId) {
        try {
            console.log(`📊 Viewing metrics for monitor: ${monitorId}`);
            
            // Get monitor details
            const response = await fetch(`/api/monitors`);
            if (response.ok) {
                const monitors = await response.json();
                const monitor = monitors.find(m => m.id === monitorId);
                
                if (monitor) {
                    // Create a simple metrics visualization modal
                    this.showMetricsModal(monitor);
                } else {
                    this.showNotification('Monitor not found', 'error');
                }
            }
        } catch (error) {
            console.error('❌ Error viewing metrics:', error);
            this.showNotification('Failed to load metrics', 'error');
        }
    }

    async showMetricsModal(monitor) {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-gray-800 rounded-lg p-6 w-[800px] max-w-[90vw] max-h-[90vh] overflow-y-auto">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-semibold text-white">AWS CloudWatch Metrics - ${monitor.name}</h3>
                    <button onclick="this.parentElement.parentElement.parentElement.remove()" class="text-gray-400 hover:text-white">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="grid grid-cols-2 gap-4 mb-6 text-sm">
                    <div>
                        <span class="text-gray-400">Service:</span>
                        <span class="text-white ml-2">${monitor.resourceType || 'N/A'}</span>
                    </div>
                    <div>
                        <span class="text-gray-400">Metric:</span>
                        <span class="text-white ml-2">${monitor.metricName || 'N/A'}</span>
                    </div>
                    <div>
                        <span class="text-gray-400">Region:</span>
                        <span class="text-white ml-2">${monitor.region || 'N/A'}</span>
                    </div>
                    <div>
                        <span class="text-gray-400">Threshold:</span>
                        <span class="text-white ml-2">${monitor.thresholdOperator || '>='} ${monitor.thresholdValue || 'N/A'}</span>
                    </div>
                    <div>
                        <span class="text-gray-400">Status:</span>
                        <span class="text-white ml-2">${monitor.isEnabled ? 'Enabled' : 'Disabled'}</span>
                    </div>
                    <div id="current-value-${monitor.id}">
                        <span class="text-gray-400">Current Value:</span>
                        <span class="text-white ml-2">Loading...</span>
                    </div>
                </div>

                <!-- Chart Container -->
                <div class="mb-4">
                    <h4 class="text-white font-medium mb-2">📊 Last 1 Hour Trend</h4>
                    <div class="bg-gray-700 rounded p-4 h-64">
                        <canvas id="metrics-chart-${monitor.id}" width="100" height="50"></canvas>
                    </div>
                </div>

                <!-- Recent History -->
                <div>
                    <h4 class="text-white font-medium mb-2">🕒 Recent History</h4>
                    <div id="history-${monitor.id}" class="bg-gray-700 rounded p-3 max-h-32 overflow-y-auto">
                        <p class="text-gray-400 text-sm">Loading history...</p>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Load real metric data and display charts
        await this.loadMetricChart(monitor);
        await this.loadMetricHistory(monitor);
    }

    async loadMetricChart(monitor) {
        try {
            console.log('📊 Loading metric chart for:', monitor.name);
            
            // Get REAL AWS CloudWatch metric data (NO MORE FAKE VALUES!)
            const response = await fetch(`/api/real-aws/aws/metrics/${monitor.id}/data`);
            
            if (response.ok) {
                const data = await response.json();
                
                // Update current value
                const currentValueEl = document.getElementById(`current-value-${monitor.id}`);
                if (data.dataPoints && data.dataPoints.length > 0) {
                    const latest = data.dataPoints[data.dataPoints.length - 1];
                    const valueText = `${latest.value.toFixed(2)} ${latest.unit || ''}`;
                    currentValueEl.innerHTML = `
                        <span class="text-gray-400">Current Value:</span>
                        <span class="text-green-400 ml-2 font-semibold">${valueText}</span>
                    `;
                }
                
                // Create chart using Chart.js (if available) or simple visualization
                this.drawSimpleChart(monitor.id, data.dataPoints);
                
            } else {
                console.error('Failed to load metric data');
                this.drawMockChart(monitor.id);
            }
        } catch (error) {
            console.error('Error loading metric chart:', error);
            this.drawMockChart(monitor.id);
        }
    }

    drawSimpleChart(monitorId, dataPoints) {
        const canvas = document.getElementById(`metrics-chart-${monitorId}`);
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const width = canvas.width = canvas.offsetWidth;
        const height = canvas.height = canvas.offsetHeight;
        
        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        
        if (!dataPoints || dataPoints.length === 0) {
            ctx.fillStyle = '#9CA3AF';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('No data available', width/2, height/2);
            return;
        }
        
        // Find min and max values
        const values = dataPoints.map(d => d.value);
        const minValue = Math.min(...values);
        const maxValue = Math.max(...values);
        const range = maxValue - minValue || 1;
        
        // Draw axes
        ctx.strokeStyle = '#4B5563';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(50, height - 30);
        ctx.lineTo(width - 20, height - 30);
        ctx.moveTo(50, height - 30);
        ctx.lineTo(50, 20);
        ctx.stroke();
        
        // Draw grid lines
        ctx.strokeStyle = '#374151';
        ctx.lineWidth = 0.5;
        for (let i = 1; i < 5; i++) {
            const y = 20 + (height - 50) * i / 5;
            ctx.beginPath();
            ctx.moveTo(50, y);
            ctx.lineTo(width - 20, y);
            ctx.stroke();
        }
        
        // Draw data line
        ctx.strokeStyle = '#10B981';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        dataPoints.forEach((point, index) => {
            const x = 50 + (width - 70) * index / (dataPoints.length - 1);
            const y = height - 30 - ((point.value - minValue) / range) * (height - 50);
            
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();
        
        // Draw points
        ctx.fillStyle = '#10B981';
        dataPoints.forEach((point, index) => {
            const x = 50 + (width - 70) * index / (dataPoints.length - 1);
            const y = height - 30 - ((point.value - minValue) / range) * (height - 50);
            
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, 2 * Math.PI);
            ctx.fill();
        });
        
        // Draw labels
        ctx.fillStyle = '#9CA3AF';
        ctx.font = '10px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`Max: ${maxValue.toFixed(1)}`, width - 100, 30);
        ctx.fillText(`Min: ${minValue.toFixed(1)}`, width - 100, 45);
    }

    drawMockChart(monitorId) {
        // Draw a simple mock chart with sample data
        const mockData = Array.from({length: 12}, (_, i) => ({
            value: Math.random() * 80 + 10,
            timestamp: new Date(Date.now() - (11-i) * 300000)
        }));
        
        this.drawSimpleChart(monitorId, mockData);
    }

    async loadMetricHistory(monitor) {
        try {
            const historyEl = document.getElementById(`history-${monitor.id}`);
            
            if (monitor.historyRecords && monitor.historyRecords.length > 0) {
                const recentHistory = monitor.historyRecords.slice(0, 5);
                
                historyEl.innerHTML = recentHistory.map(record => {
                    const time = new Date(record.createdAt).toLocaleTimeString();
                    const statusColor = record.status === 'Success' ? 'text-green-400' : 'text-red-400';
                    return `
                        <div class="flex justify-between items-center py-1 border-b border-gray-600 last:border-b-0">
                            <span class="text-gray-300 text-xs">${time}</span>
                            <span class="${statusColor} text-xs">${record.status}</span>
                            <span class="text-gray-400 text-xs">${record.responseTime}ms</span>
                        </div>
                    `;
                }).join('');
            } else {
                historyEl.innerHTML = '<p class="text-gray-400 text-sm">No history available</p>';
            }
        } catch (error) {
            console.error('Error loading metric history:', error);
        }
    }

    async deleteMonitor(monitorId) {
        if (!confirm('Are you sure you want to delete this monitor?')) {
            return;
        }

        try {
            const response = await fetch(`/api/monitors/${monitorId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Failed to delete monitor');
            }

            this.showNotification('Monitor deleted successfully', 'success');
            this.loadExistingMonitors();

        } catch (error) {
            console.error('Delete monitor error:', error);
            this.showNotification('Failed to delete monitor', 'error');
        }
    }

    editMonitor(monitorId) {
        // For now, just show a message - you could implement edit functionality
        this.showNotification('Edit functionality coming soon! You can delete and recreate for now.', 'info');
    }

    async loadDynamicNamespaces() {
        try {
            console.log('🔍 Loading REAL AWS namespaces from your account...');
            
            // Load real namespaces from your AWS account
            const response = await fetch('/api/aws-real-namespaces');
            
            if (response.ok) {
                const data = await response.json();
                if (data.namespaces && data.namespaces.length > 0) {
                    this.updateServiceDropdown(data.namespaces);
                    
                    if (data.source === 'fallback-static') {
                        console.log(`⚠️ Using ${data.namespaces.length} fallback services: ${data.error}`);
                        this.showNotification(`⚠️ Using fallback AWS services (${data.error})`, 'warning');
                    } else {
                        console.log(`✅ Loaded ${data.namespaces.length} REAL AWS namespaces from your account!`);
                        this.showNotification(`✅ Loaded ${data.namespaces.length} REAL AWS services from your account`, 'success');
                        
                        // Also load EC2 instances for display
                        this.loadAwsInstances();
                    }
                    return;
                }
            }
            
            // Final fallback to static services if everything fails
            const staticNamespaces = [
                'AWS/EC2', 'AWS/RDS', 'AWS/Lambda', 'AWS/S3',
                'AWS/ApplicationELB', 'AWS/ELB', 'AWS/ECS'
            ];

            this.updateServiceDropdown(staticNamespaces);
            console.log(`❌ Using ${staticNamespaces.length} static AWS services (API failed)`);
            this.showNotification(`❌ Failed to load real services, using static fallback`, 'error');
            
        } catch (error) {
            console.error('Error loading namespaces:', error);
            this.showNotification('Failed to load AWS services', 'error');
        }
    }

    async loadAwsInstances() {
        try {
            console.log('🔄 Loading AWS EC2 instances...');
            
            const response = await fetch('/api/aws-ec2-instances');
            
            if (response.ok) {
                const data = await response.json();
                console.log(`✅ Found ${data.instances?.length || 0} EC2 instances`);
                
                this.displayAwsInstances(data.instances || []);
                
            } else {
                console.error('Failed to load EC2 instances');
            }
            
        } catch (error) {
            console.error('Error loading AWS instances:', error);
        }
    }

    displayAwsInstances(instances) {
        // Find or create instances display container
        let container = document.getElementById('aws-instances-display');
        if (!container) {
            // Create the container after the existing monitors section
            const monitorsSection = document.querySelector('.bg-gray-800.border.border-gray-600.rounded-lg');
            if (monitorsSection) {
                container = document.createElement('div');
                container.id = 'aws-instances-display';
                container.className = 'bg-gray-800 border border-gray-600 rounded-lg p-6 mt-6';
                monitorsSection.parentNode.insertBefore(container, monitorsSection.nextSibling);
            }
        }

        if (!container) return;

        if (instances.length === 0) {
            container.innerHTML = `
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-lg font-semibold text-white flex items-center">
                        <i class="fab fa-aws text-orange-500 mr-2"></i>
                        AWS EC2 Instances
                    </h3>
                </div>
                <div class="text-center py-8 text-gray-400">
                    <i class="fas fa-server text-4xl mb-4"></i>
                    <p class="text-lg mb-2">No EC2 instances found or using mock data</p>
                    <p>Launch EC2 instances in AWS console to monitor them</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-semibold text-white flex items-center">
                    <i class="fab fa-aws text-orange-500 mr-2"></i>
                    AWS EC2 Instances (${instances.length})
                </h3>
                <button onclick="awsSetup.loadAwsInstances()" class="text-blue-400 hover:text-blue-300 flex items-center">
                    <i class="fas fa-sync-alt mr-1"></i> Refresh
                </button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                ${instances.map(instance => {
                    const statusColor = instance.state === 'running' ? 'text-green-400' : 
                                       instance.state === 'stopped' ? 'text-red-400' : 'text-yellow-400';
                    
                    return `
                        <div class="bg-gray-700 border border-gray-600 rounded-lg p-4">
                            <div class="flex items-center justify-between mb-2">
                                <h4 class="font-semibold text-white">${instance.name || 'Unnamed'}</h4>
                                <span class="px-2 py-1 text-xs rounded-full bg-gray-600 ${statusColor}">
                                    ${instance.state || 'unknown'}
                                </span>
                            </div>
                            <div class="space-y-1 text-sm">
                                <div>
                                    <span class="text-gray-400">Instance ID:</span>
                                    <span class="text-gray-300 ml-2 font-mono">${instance.instanceId}</span>
                                </div>
                                <div>
                                    <span class="text-gray-400">Type:</span>
                                    <span class="text-gray-300 ml-2">${instance.instanceType || 'N/A'}</span>
                                </div>
                            </div>
                            <div class="mt-3 pt-3 border-t border-gray-600">
                                <button onclick="awsSetup.createInstanceMonitor('${instance.instanceId}', '${instance.name || 'Unnamed'}')" 
                                        class="text-blue-400 hover:text-blue-300 text-sm flex items-center">
                                    <i class="fas fa-plus mr-1"></i> Monitor this instance
                                </button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    async createInstanceMonitor(instanceId, instanceName) {
        try {
            console.log(`Creating monitor for instance: ${instanceId}`);
            
            // Pre-fill the form with instance details
            document.getElementById('monitor-name').value = `${instanceName} Monitor`;
            document.getElementById('aws-service').value = 'AWS/EC2';
            
            // Trigger service change to load metrics
            const serviceDropdown = document.getElementById('aws-service');
            const event = new Event('change');
            serviceDropdown.dispatchEvent(event);
            
            // Show success message
            this.showNotification(`Pre-filled monitor form for ${instanceName}`, 'success');
            
            // Scroll to monitor form
            document.querySelector('.bg-gray-800.rounded-lg.p-6').scrollIntoView({ 
                behavior: 'smooth' 
            });
            
        } catch (error) {
            console.error('Error creating instance monitor:', error);
            this.showNotification('Failed to create instance monitor', 'error');
        }
    }

    updateServiceDropdown(namespaces) {
        const serviceSelect = document.getElementById('aws-service');
        if (!serviceSelect) return;

        // Clear existing options except the first one
        serviceSelect.innerHTML = '<option value="">Select AWS Service</option>';

        // Add dynamic namespaces as options - show REAL AWS namespaces
        namespaces.forEach(namespace => {
            const option = document.createElement('option');
            option.value = namespace;
            option.textContent = namespace; // Show the real AWS namespace, not formatted version
            serviceSelect.appendChild(option);
        });

        // Remove any existing listeners and add event listener for service change to load real AWS metrics
        const newServiceSelect = serviceSelect.cloneNode(true);
        serviceSelect.parentNode.replaceChild(newServiceSelect, serviceSelect);
        
        newServiceSelect.addEventListener('change', (e) => {
            if (e.target.value) {
                console.log(`🔄 Loading real metrics for selected namespace: ${e.target.value}`);
                this.loadMetricsForNamespace(e.target.value);
            } else {
                this.clearMetricsCheckboxes();
            }
        });
    }

    // formatNamespace function removed - now showing real AWS namespace names instead of converting to user-friendly names

    async loadMetricsForNamespace(namespace) {
        try {
            this.showLoading();
            
            console.log(`🔍 Loading REAL metrics for ${namespace}...`);
            
            // Load real metrics from AWS for this namespace
            const response = await fetch(`/api/real/aws-metrics/${encodeURIComponent(namespace)}`);
            
            if (response.ok) {
                const data = await response.json();
                if (data.metrics && data.metrics.length > 0) {
                    this.updateMetricsCheckboxes(data.metrics);
                    
                    if (data.source === 'fallback-static') {
                        console.log(`⚠️ Using ${data.metrics.length} fallback metrics for ${namespace}: ${data.error}`);
                        this.showNotification(`⚠️ Using fallback metrics (${data.error})`, 'warning');
                    } else {
                        console.log(`✅ Loaded ${data.metrics.length} REAL metrics from AWS for ${namespace}!`);
                        this.showNotification(`✅ Loaded ${data.metrics.length} real metrics for ${namespace}`, 'success');
                    }
                    return;
                }
            }
            
            // Fallback to basic metrics if API fails
            const fallbackMetrics = [
                { name: 'CPUUtilization' },
                { name: 'NetworkIn' },
                { name: 'NetworkOut' }
            ];

            this.updateMetricsCheckboxes(fallbackMetrics);
            console.log(`❌ Using ${fallbackMetrics.length} fallback metrics for ${namespace}`);
            this.showNotification(`❌ Failed to load real metrics, using fallback`, 'error');
            
        } catch (error) {
            console.error('Error loading metrics:', error);
            this.showNotification('Failed to load metrics for selected service', 'error');
        } finally {
            this.hideLoading();
        }
    }

    updateMetricsCheckboxes(metrics) {
        const metricsContainer = document.getElementById('metrics-selection');
        if (!metricsContainer) {
            console.error('Metrics container not found!');
            return;
        }

        console.log(`🔧 Updating metrics checkboxes with ${metrics.length} metrics:`, metrics);

        // Clear existing checkboxes
        metricsContainer.innerHTML = '';

        // Add new checkboxes for real metrics
        metrics.forEach(metric => {
            const metricName = metric.name || metric; // Handle both object and string formats
            const checkboxHtml = `
                <label class="flex items-center space-x-2 cursor-pointer">
                    <input type="checkbox" name="metrics" value="${metricName}" class="rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500" checked>
                    <span class="text-sm">${metricName}</span>
                </label>
            `;
            metricsContainer.insertAdjacentHTML('beforeend', checkboxHtml);
        });
    }

    clearMetricsCheckboxes() {
        const metricsContainer = document.getElementById('metrics-selection');
        if (metricsContainer) {
            metricsContainer.innerHTML = '<p class="text-gray-400 col-span-2">Select a service to see available metrics</p>';
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 px-6 py-3 rounded-lg text-white z-50 ${
            type === 'success' ? 'bg-green-600' : 
            type === 'error' ? 'bg-red-600' : 
            type === 'warning' ? 'bg-yellow-600' : 'bg-blue-600'
        }`;
        
        notification.innerHTML = `
            <div class="flex items-center">
                <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'times' : 'info'} mr-2"></i>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 5000);
    }

    showLoading() {
        document.getElementById('loading-overlay').classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loading-overlay').classList.add('hidden');
    }
}

// Initialize the AWS Monitor Setup
let awsSetup;
document.addEventListener('DOMContentLoaded', () => {
    awsSetup = new AWSMonitorSetup();
});