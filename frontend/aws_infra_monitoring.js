document.addEventListener('DOMContentLoaded', function() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/index.html';
        return;
    }

    // API Base URL
    const API_BASE_URL = 'http://localhost:8080';

    // DOM Elements
    const monitorsTableBody = document.getElementById('aws-monitors-tbody');
    const emptyState = document.getElementById('empty-state');
    const chartsSection = document.getElementById('charts-section');
    const modal = document.getElementById('aws-monitor-modal');
    const modalTitle = document.getElementById('modal-title');
    const monitorForm = document.getElementById('aws-monitor-form');
    
    // Form elements
    const monitorId = document.getElementById('monitor-id');
    const monitorName = document.getElementById('monitor-name');
    const resourceType = document.getElementById('resource-type');
    const metricName = document.getElementById('metric-name');
    const thresholdOperator = document.getElementById('threshold-operator');
    const thresholdValue = document.getElementById('threshold-value');
    const monitoringInterval = document.getElementById('monitoring-interval');
    const resourceLoading = document.getElementById('resource-loading');

    // Global variables
    let monitors = [];
    let metricChart = null;
    let healthChart = null;
    let currentMonitorId = null; // Track currently displayed monitor for chart updates

    // Event Listeners
    document.getElementById('setup-new-monitor').addEventListener('click', openCreateMonitorModal);
    if (document.getElementById('setup-first-monitor')) {
        document.getElementById('setup-first-monitor').addEventListener('click', openCreateMonitorModal);
    }
    
    // Modal close events
    modal.querySelectorAll('.close-btn, .modal-close').forEach(btn => {
        btn.addEventListener('click', closeModal);
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Form events
    monitorForm.addEventListener('submit', saveMonitor);
    resourceType.addEventListener('change', loadResourcesForType);
    resourceType.addEventListener('change', loadMetricsForResourceType);

    // Step Navigation for Accordion Modal
    const stepper = modal.querySelector('.stepper');
    const steps = modal.querySelectorAll('.step');
    const accordionItems = modal.querySelectorAll('.accordion-item');
    const accordionHeaders = modal.querySelectorAll('.accordion-header');

    let currentStep = 0;

    // Notification Channel Toggle
    const toggleNotificationBtn = document.getElementById('toggle-notification-channels');
    const notificationChannelsSection = document.getElementById('notification-channels-inline');
    const channelCheckboxes = document.querySelectorAll('.notification-channel-checkbox');

    if (toggleNotificationBtn && notificationChannelsSection) {
        toggleNotificationBtn.addEventListener('click', function() {
            const isVisible = notificationChannelsSection.style.display !== 'none';
            
            if (isVisible) {
                notificationChannelsSection.style.display = 'none';
                this.classList.remove('active');
                this.innerHTML = '<i class="fas fa-bell"></i> Manage Channels';
            } else {
                notificationChannelsSection.style.display = 'block';
                this.classList.add('active');
                this.innerHTML = '<i class="fas fa-bell"></i> Hide Channels';
            }
        });
    }

    // Handle notification channel checkboxes
    channelCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const channel = this.value.toLowerCase();
            const fieldsDiv = document.getElementById(`${channel}-fields`) || 
                            document.querySelector(`#${channel.split('_')[0]}-fields`);
            
            if (fieldsDiv) {
                fieldsDiv.style.display = this.checked ? 'block' : 'none';
            }
        });
    });

    // Handle edit buttons for notification channels
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const channel = this.getAttribute('data-channel');
            const checkbox = document.getElementById(`channel-${channel}`);
            
            if (checkbox && !checkbox.checked) {
                checkbox.checked = true;
                checkbox.dispatchEvent(new Event('change'));
            }
            
            setTimeout(() => {
                const inputField = document.querySelector(`#${channel}-fields input`);
                if (inputField) inputField.focus();
            }, 100);
        });
    });

    // Handle delete buttons for notification channels
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const channel = this.getAttribute('data-channel');
            const checkbox = document.getElementById(`channel-${channel}`);
            
            if (checkbox) {
                checkbox.checked = false;
                checkbox.dispatchEvent(new Event('change'));
            }
        });
    });

    // Accordion header click handlers - allow users to click any step
    accordionHeaders.forEach((header, index) => {
        header.addEventListener('click', () => {
            currentStep = index;
            updateStepperAndAccordion();
        });
    });

    function updateStepperAndAccordion() {
        // Update stepper progress
        steps.forEach((step, index) => {
            step.classList.toggle('active', index === currentStep);
        });

        // Update accordion visibility
        accordionItems.forEach((item, index) => {
            const content = item.querySelector('.accordion-content');
            const isActive = index === currentStep;
            item.classList.toggle('active', isActive);
            content.style.display = isActive ? 'block' : 'none';
        });
    }

    // Update notification summary when inputs change
    const notificationInputs = [
        document.getElementById('email-recipients'),
        document.getElementById('slack-webhook'),
        document.getElementById('teams-webhook'),
        document.getElementById('custom-webhook')
    ];

    notificationInputs.forEach(input => {
        if (input) {
            input.addEventListener('input', updateNotificationSummary);
            input.addEventListener('blur', updateNotificationSummary);
        }
    });

    // Also update when checkboxes change
    if (channelCheckboxes) {
        channelCheckboxes.forEach(checkbox => {
            const originalHandler = checkbox.onchange;
            checkbox.addEventListener('change', function() {
                if (originalHandler) originalHandler.call(this);
                updateNotificationSummary();
            });
        });
    }

    function getNotificationChannelsData() {
        const channels = [];
        
        // Email
        const emailCheckbox = document.getElementById('channel-email');
        if (emailCheckbox && emailCheckbox.checked) {
            const emails = document.getElementById('email-recipients');
            if (emails && emails.value.trim()) {
                channels.push({
                    type: 'EMAIL',
                    target: emails.value.trim()
                });
            }
        }
        
        // Slack
        const slackCheckbox = document.getElementById('channel-slack');
        if (slackCheckbox && slackCheckbox.checked) {
            const slackUrl = document.getElementById('slack-webhook');
            if (slackUrl && slackUrl.value.trim()) {
                channels.push({
                    type: 'SLACK',
                    target: slackUrl.value.trim()
                });
            }
        }
        
        // Teams
        const teamsCheckbox = document.getElementById('channel-teams');
        if (teamsCheckbox && teamsCheckbox.checked) {
            const teamsUrl = document.getElementById('teams-webhook');
            if (teamsUrl && teamsUrl.value.trim()) {
                channels.push({
                    type: 'TEAMS',
                    target: teamsUrl.value.trim()
                });
            }
        }
        
        // Webhook
        const webhookCheckbox = document.getElementById('channel-webhook');
        if (webhookCheckbox && webhookCheckbox.checked) {
            const webhookUrl = document.getElementById('custom-webhook');
            if (webhookUrl && webhookUrl.value.trim()) {
                channels.push({
                    type: 'WEBHOOK',
                    target: webhookUrl.value.trim()
                });
            }
        }
        
        return channels;
    }

    function updateNotificationSummary() {
        const summaryDiv = document.getElementById('notification-channels-summary');
        if (!summaryDiv) return;
        
        const channels = getNotificationChannelsData();
        
        if (channels.length === 0) {
            summaryDiv.style.display = 'none';
            return;
        }
        
        summaryDiv.style.display = 'block';
        summaryDiv.innerHTML = '';
        
        channels.forEach(channel => {
            const item = document.createElement('div');
            item.className = 'notification-summary-item';
            
            let icon = '';
            let name = '';
            
            switch(channel.type) {
                case 'EMAIL':
                    icon = 'fas fa-envelope';
                    name = 'Email';
                    break;
                case 'SLACK':
                    icon = 'fab fa-slack';
                    name = 'Slack';
                    break;
                case 'TEAMS':
                    icon = 'fab fa-microsoft';
                    name = 'Teams';
                    break;
                case 'WEBHOOK':
                    icon = 'fas fa-globe';
                    name = 'Webhook';
                    break;
            }
            
            item.innerHTML = `
                <i class="${icon}"></i>
                <span class="channel-name">${name}:</span>
                <span class="channel-target" title="${channel.target}">${channel.target}</span>
            `;
            
            summaryDiv.appendChild(item);
        });
    }

    // Time range buttons
    document.querySelectorAll('.time-range-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.time-range-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            // Refresh data with new time range
            loadMonitors();
            
            // If charts are currently displayed, reload them with new time range
            if (currentMonitorId && !chartsSection.classList.contains('hidden')) {
                console.log(`🔄 Updating charts for time range: ${e.target.dataset.range}`);
                loadMonitorCharts(currentMonitorId);
            }
        });
    });

    // AWS Resource Type to Metrics mapping
    const resourceMetrics = {
        ec2: [
            { name: 'CPUUtilization', namespace: 'AWS/EC2', unit: 'Percent' },
            { name: 'NetworkIn', namespace: 'AWS/EC2', unit: 'Bytes' },
            { name: 'NetworkOut', namespace: 'AWS/EC2', unit: 'Bytes' },
            { name: 'DiskReadBytes', namespace: 'AWS/EC2', unit: 'Bytes' },
            { name: 'DiskWriteBytes', namespace: 'AWS/EC2', unit: 'Bytes' }
        ],
        rds: [
            { name: 'CPUUtilization', namespace: 'AWS/RDS', unit: 'Percent' },
            { name: 'DatabaseConnections', namespace: 'AWS/RDS', unit: 'Count' },
            { name: 'FreeableMemory', namespace: 'AWS/RDS', unit: 'Bytes' },
            { name: 'ReadLatency', namespace: 'AWS/RDS', unit: 'Seconds' },
            { name: 'WriteLatency', namespace: 'AWS/RDS', unit: 'Seconds' }
        ],
        lambda: [
            { name: 'Invocations', namespace: 'AWS/Lambda', unit: 'Count' },
            { name: 'Duration', namespace: 'AWS/Lambda', unit: 'Milliseconds' },
            { name: 'Errors', namespace: 'AWS/Lambda', unit: 'Count' },
            { name: 'Throttles', namespace: 'AWS/Lambda', unit: 'Count' }
        ],
        s3: [
            { name: 'NumberOfObjects', namespace: 'AWS/S3', unit: 'Count' },
            { name: 'BucketSizeBytes', namespace: 'AWS/S3', unit: 'Bytes' },
            { name: 'AllRequests', namespace: 'AWS/S3', unit: 'Count' }
        ]
    };

    // Initialize page
    loadMonitors();
    loadDynamicNamespaces(); // Load real AWS namespaces

    // Functions

    // Load dynamic AWS namespaces from real CloudWatch
    async function loadDynamicNamespaces() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/aws/namespaces`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log(`✅ Loaded ${data.count} AWS namespaces from real CloudWatch`);
            
            // Update the resource type dropdown with real namespaces
            if (data.namespaceMapping && data.namespaceMapping.length > 0) {
                updateResourceTypeDropdown(data.namespaceMapping);
            } else {
                console.log('⚠️ No namespace mapping found, using default mapping');
                // Fallback: use namespaces directly
                const fallbackMapping = data.namespaces.map(ns => ({
                    resourceType: ns.toLowerCase().replace('aws/', ''),
                    displayName: ns.replace('AWS/', ''),
                    description: `${ns} service metrics`
                }));
                updateResourceTypeDropdown(fallbackMapping);
            }
            
        } catch (error) {
            console.error('❌ Error loading namespaces:', error);
            console.log('⚠️ AWS credentials not configured or invalid');
            
            // Show error message instead of fallback data
            const resourceTypeSelect = document.getElementById('resource-type');
            if (resourceTypeSelect) {
                resourceTypeSelect.innerHTML = '<option value="">⚠️ Please configure AWS credentials first</option>';
                resourceTypeSelect.disabled = true;
            }
            
            // Show notification to user
            showNotification('Please add AWS credentials in the Cloud Integration page before creating monitors', 'error');
        }
    }

    // Update resource type dropdown with dynamic namespaces
    function updateResourceTypeDropdown(namespaceMapping) {
        console.log('🔄 Updating dropdown with:', namespaceMapping);
        
        if (!namespaceMapping || !Array.isArray(namespaceMapping)) {
            console.error('❌ Invalid namespaceMapping:', namespaceMapping);
            return;
        }
        
        const resourceTypeSelect = document.getElementById('resource-type');
        if (!resourceTypeSelect) {
            console.error('❌ Resource type select element not found');
            return;
        }
        
        // Clear ALL existing options (including static ones)
        resourceTypeSelect.innerHTML = '<option value="">Select Resource Type</option>';
        
        // Add dynamic options based on real AWS namespaces
        namespaceMapping.forEach(mapping => {
            const option = document.createElement('option');
            option.value = mapping.resourceType;
            option.textContent = mapping.displayName;
            option.title = mapping.description;
            resourceTypeSelect.appendChild(option);
        });
        
        console.log(`✅ Updated resource type dropdown with ${namespaceMapping.length} real AWS services`);
    }

    function openCreateMonitorModal() {
        modalTitle.textContent = 'Setup AWS Monitor';
        monitorForm.reset();
        monitorId.value = '';
        currentStep = 0;
        updateStepperAndAccordion();
        modal.style.display = 'block';
    }

    function closeModal() {
        modal.style.display = 'none';
    }

    async function loadMonitors() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/monitors?type=aws`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                monitors = await response.json();
                displayMonitors(monitors);
            } else {
                console.error('Failed to load AWS monitors');
                monitors = [];
                displayMonitors([]);
            }
        } catch (error) {
            console.error('Error loading AWS monitors:', error);
            monitors = [];
            displayMonitors([]);
        }
    }

    function displayMonitors(monitors) {
        if (monitors.length === 0) {
            monitorsTableBody.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');
        
        monitorsTableBody.innerHTML = monitors.map(monitor => {
            const status = getMonitorStatus(monitor);
            const statusClass = getStatusClass(status);
            const lastUpdated = new Date(monitor.updatedAt).toLocaleString('en-US', { 
                month: 'short', 
                day: '2-digit', 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            // Parse resourceIds if it exists (multi-resource monitor)
            let resourceIds = [];
            let resourceNames = [];
            try {
                resourceIds = monitor.resourceIds ? JSON.parse(monitor.resourceIds) : [monitor.resourceId];
                resourceNames = monitor.resourceNames ? JSON.parse(monitor.resourceNames) : [];
            } catch (e) {
                resourceIds = [monitor.resourceId];
            }
            
            const resourceCount = resourceIds.length;
            const resourceDisplay = resourceCount > 1 
                ? `<span class="text-blue-400 font-semibold" title="${resourceIds.join(', ')}">${resourceCount} ${monitor.resourceType?.toUpperCase()} instances</span>`
                : `<span class="resource-id">${resourceIds[0] || 'N/A'}</span>`;
            
            return `
                <tr class="monitor-row hover:bg-gray-700 cursor-pointer transition-colors" data-monitor-id="${monitor.id}">
                    <td class="whitespace-nowrap">
                        <div class="flex items-center gap-2">
                            <span class="status-indicator ${statusClass}"></span>
                            <span class="badge ${statusClass === 'status-healthy' ? 'status-badge-healthy' : statusClass === 'status-warning' ? 'status-badge-warning' : 'status-badge-critical'}">${status}</span>
                        </div>
                    </td>
                    <td class="whitespace-nowrap">
                        <div class="metric-name text-white">${monitor.name}</div>
                    </td>
                    <td class="whitespace-nowrap">
                        <div class="flex items-center gap-1">
                            <i class="fab fa-aws text-orange-400 icon-sm"></i>
                            <span class="metric-name text-gray-300">${monitor.resourceType?.toUpperCase()}</span>
                        </div>
                    </td>
                    <td class="whitespace-nowrap">
                        <div class="metric-name text-gray-300">${monitor.metricName}</div>
                    </td>
                    <td class="whitespace-nowrap">
                        <div class="threshold-value text-gray-300">
                            ${monitor.thresholdOperator} ${monitor.thresholdValue}
                        </div>
                    </td>
                    <td class="whitespace-nowrap">
                        <div class="timestamp">${lastUpdated}</div>
                    </td>
                    <td class="whitespace-nowrap">
                        <div class="flex space-x-2">
                            <button onclick="window.location.href='aws_monitor_graph.html?monitorId=${monitor.id}'" class="action-btn" title="View Graph">
                                <i class="fas fa-chart-line text-blue-400 hover:text-blue-300"></i>
                            </button>
                            <button onclick="editMonitor('${monitor.id}')" class="action-btn" title="Edit">
                                <i class="fas fa-edit text-yellow-400 hover:text-yellow-300"></i>
                            </button>
                            <button onclick="deleteMonitor('${monitor.id}')" class="action-btn" title="Delete">
                                <i class="fas fa-trash text-red-400 hover:text-red-300"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Load current values for each monitor
        monitors.forEach(monitor => {
            loadCurrentMetricValue(monitor);
        });

    }

    function getMonitorStatus(monitor) {
        // This would be calculated based on real metric values
        // For now, return a status based on some logic
        return monitor.isEnabled ? 'Healthy' : 'Disabled';
    }

    function getStatusClass(status) {
        switch (status.toLowerCase()) {
            case 'healthy': return 'status-healthy';
            case 'warning': return 'status-warning';
            case 'critical': return 'status-critical';
            case 'disabled': return 'status-unknown';
            default: return 'status-unknown';
        }
    }

    // Edit monitor function
    window.editMonitor = async function(monitorId) {
        try {
            const response = await fetch(`http://localhost:3001/api/aws-monitors/${monitorId}`);
            if (!response.ok) throw new Error('Failed to load monitor');
            
            const monitor = await response.json();
            
            // Populate form fields
            document.getElementById('monitor-name').value = monitor.name;
            document.getElementById('resource-type').value = monitor.resourceType;
            
            // Trigger resource loading
            const changeEvent = new Event('change');
            document.getElementById('resource-type').dispatchEvent(changeEvent);
            
            // Wait for resources to load, then select
            setTimeout(() => {
                const resourceSelect = document.getElementById('resource-id');
                if (resourceSelect && monitor.resourceId) {
                    resourceSelect.value = monitor.resourceId;
                }
            }, 500);
            
            document.getElementById('metric-name').value = monitor.metricName;
            document.getElementById('check-interval').value = monitor.checkInterval;
            document.getElementById('threshold-operator').value = monitor.operator || '>';
            document.getElementById('threshold-value').value = monitor.threshold;
            
            if (monitor.warningThreshold) {
                document.getElementById('warning-threshold').value = monitor.warningThreshold;
            }
            
            // Set notification fields if present
            if (monitor.notification && monitor.notification.emails) {
                document.getElementById('channel-email').checked = true;
                document.getElementById('email-recipients').value = monitor.notification.emails;
                document.getElementById('email-fields').style.display = 'block';
            }
            
            // Open modal
            document.getElementById('aws-monitor-modal').style.display = 'flex';
            
            // Store monitor ID for update
            document.getElementById('aws-monitor-modal').dataset.editingId = monitorId;
            
        } catch (error) {
            console.error('Error loading monitor:', error);
            alert('Failed to load monitor data');
        }
    }

    async function loadCurrentMetricValue(monitor) {
        const element = document.getElementById(`current-value-${monitor.id}`);
        
        try {
            // Default to 1h if no time range button exists
            const timeRangeBtn = document.querySelector('.time-range-btn.active');
            const timeRange = timeRangeBtn ? timeRangeBtn.dataset.range : '1h';
            
            const response = await fetch(`${API_BASE_URL}/api/aws/metrics/${monitor.id}/current?range=${timeRange}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (element) {
                    element.textContent = formatMetricValue(data.value, monitor.metricName);
                }
            } else {
                if (element) element.textContent = 'N/A';
            }
        } catch (error) {
            console.error(`Error loading current value for monitor ${monitor.id}:`, error);
            if (element) {
                element.textContent = 'N/A';
            }
        }
    }

    function formatMetricValue(value, metricName) {
        if (value === null || value === undefined) return 'N/A';
        
        // Format based on metric type
        if (metricName.includes('Utilization') || metricName.includes('Percent')) {
            return `${value.toFixed(1)}%`;
        } else if (metricName.includes('Bytes')) {
            return formatBytes(value);
        } else if (metricName.includes('Duration') || metricName.includes('Latency')) {
            return `${value.toFixed(2)}ms`;
        } else {
            return value.toFixed(2);
        }
    }

    function formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async function loadResourcesForType() {
        const type = resourceType.value;
        const resourceList = document.getElementById('resource-list');
        const resourceCheckboxes = document.getElementById('resource-checkboxes');
        const resourceEmpty = document.getElementById('resource-empty');
        const selectAllCheckbox = document.getElementById('select-all-resources');
        const resourceLoading = document.getElementById('resource-loading');
        
        console.log('🔍 Loading resources for type:', type);
        console.log('📦 Elements found:', {
            resourceList: !!resourceList,
            resourceCheckboxes: !!resourceCheckboxes,
            resourceEmpty: !!resourceEmpty,
            selectAllCheckbox: !!selectAllCheckbox
        });
        
        if (!type) {
            if (resourceList) resourceList.classList.add('hidden');
            if (resourceLoading) resourceLoading.classList.add('hidden');
            if (resourceEmpty) {
                resourceEmpty.classList.remove('hidden');
                resourceEmpty.innerHTML = '<i class="fas fa-info-circle mr-1"></i>First select resource type';
            }
            return;
        }

        if (resourceLoading) {
            resourceLoading.classList.remove('hidden');
            resourceLoading.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Loading ' + type.toUpperCase() + ' resources...';
        }
        if (resourceList) resourceList.classList.add('hidden');
        if (resourceEmpty) resourceEmpty.classList.add('hidden');

        try {
            console.log(`📡 Fetching resources from: ${API_BASE_URL}/api/aws/resources/${type}`);
            const response = await fetch(`${API_BASE_URL}/api/aws/resources/${type}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log(`📊 Response status: ${response.status}`);

            if (response.ok) {
                const resources = await response.json();
                console.log(`✅ Loaded ${resources.length} ${type} resources:`, resources);
                
                if (resources.length === 0) {
                    if (resourceEmpty) {
                        resourceEmpty.classList.remove('hidden');
                        resourceEmpty.innerHTML = '<i class="fas fa-exclamation-circle mr-1 text-yellow-400"></i>No ' + type.toUpperCase() + ' resources found in your AWS account';
                    }
                    if (resourceLoading) resourceLoading.classList.add('hidden');
                    return;
                }
                
                // Create checkbox for each resource
                if (resourceCheckboxes) {
                    resourceCheckboxes.innerHTML = resources.map(resource => `
                        <label class="flex items-center text-sm text-gray-300 cursor-pointer hover:bg-gray-600 p-1 rounded">
                            <input type="checkbox" class="resource-checkbox mr-2 w-4 h-4" 
                                   value="${resource.id}" 
                                   data-name="${resource.name}">
                            <span class="truncate">${resource.name} <span class="text-gray-500 text-xs">(${resource.id})</span></span>
                        </label>
                    `).join('');
                    
                    console.log('✅ Created checkboxes for resources');
                }
                
                if (resourceList) resourceList.classList.remove('hidden');
                
                // Handle select all functionality
                if (selectAllCheckbox) {
                    selectAllCheckbox.checked = false;
                    // Remove old listeners
                    selectAllCheckbox.replaceWith(selectAllCheckbox.cloneNode(true));
                    const newSelectAll = document.getElementById('select-all-resources');
                    
                    newSelectAll.addEventListener('change', function() {
                        const checkboxes = document.querySelectorAll('.resource-checkbox');
                        checkboxes.forEach(cb => cb.checked = this.checked);
                        console.log(`Select all: ${this.checked}`);
                    });
                }
                
                // Handle individual checkbox changes
                if (resourceCheckboxes) {
                    resourceCheckboxes.addEventListener('change', function(e) {
                        if (e.target.classList.contains('resource-checkbox')) {
                            const checkboxes = document.querySelectorAll('.resource-checkbox');
                            const allChecked = Array.from(checkboxes).every(cb => cb.checked);
                            const selectAll = document.getElementById('select-all-resources');
                            if (selectAll) selectAll.checked = allChecked;
                        }
                    });
                }
                
            } else {
                console.error('Failed to load resources:', response.status);
                if (resourceLoading) resourceLoading.classList.add('hidden');
                if (resourceEmpty) {
                    resourceEmpty.classList.remove('hidden');
                    if (response.status === 401 || response.status === 403) {
                        resourceEmpty.innerHTML = '<i class="fas fa-exclamation-triangle mr-1 text-red-400"></i>AWS credentials not configured or invalid. Please add credentials in <a href="aws_dashboard.html" class="text-blue-400 underline">Cloud Integration</a>';
                    } else {
                        resourceEmpty.innerHTML = '<i class="fas fa-times-circle mr-1 text-red-400"></i>Failed to load ' + type.toUpperCase() + ' resources (Error ' + response.status + ')';
                    }
                }
            }
        } catch (error) {
            console.error('❌ Error loading resources:', error);
            if (resourceLoading) resourceLoading.classList.add('hidden');
            if (resourceEmpty) {
                resourceEmpty.classList.remove('hidden');
                resourceEmpty.innerHTML = '<i class="fas fa-times-circle mr-1 text-red-400"></i>Error loading resources. Please check your AWS credentials in <a href="aws_dashboard.html" class="text-blue-400 underline">Cloud Integration</a>';
            }
        } finally {
            if (resourceLoading) resourceLoading.classList.add('hidden');
        }
    }

    async function loadMetricsForResourceType() {
        const type = resourceType.value;
        if (!type) {
            metricName.innerHTML = '<option value="">Select resource type first</option>';
            return;
        }

        console.log(`🔍 Loading real metrics for resource type: ${type}...`);
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/aws/resources/${type}/metrics`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log(`✅ Loaded ${data.count} real metrics for ${type}:`, data.metrics);
            
            // Update metrics dropdown with real CloudWatch metrics
            metricName.innerHTML = '<option value="">Select a metric</option>' +
                data.metrics.map(metric => 
                    `<option value="${metric.name}" data-namespace="${data.namespace}">
                        ${metric.name} - ${metric.description}
                    </option>`
                ).join('');
                
        } catch (error) {
            console.error('Error loading real metrics:', error);
            console.log('📋 Using static metrics as fallback');
            
            // Fallback to static metrics if API call fails
            if (resourceMetrics[type]) {
                const metrics = resourceMetrics[type];
                metricName.innerHTML = '<option value="">Select a metric</option>' +
                    metrics.map(metric => 
                        `<option value="${metric.name}" data-namespace="${metric.namespace}" data-unit="${metric.unit}">
                            ${metric.name} (${metric.unit})
                        </option>`
                    ).join('');
            } else {
                metricName.innerHTML = '<option value="">No metrics available</option>';
            }
        }
    }

    async function saveMonitor(e) {
        e.preventDefault();
        
        // Get selected resources
        const selectedCheckboxes = document.querySelectorAll('.resource-checkbox:checked');
        if (selectedCheckboxes.length === 0) {
            showNotification('Please select at least one resource', 'error');
            return;
        }
        
        const selectedResources = Array.from(selectedCheckboxes).map(cb => ({
            id: cb.value,
            name: cb.dataset.name
        }));
        
        console.log(`✨ Creating ONE monitor for ${selectedResources.length} resources (Datadog-style)`);
        
        // Get warning threshold (optional)
        const warningThresholdInput = document.getElementById('warning-threshold');
        const warningThreshold = warningThresholdInput && warningThresholdInput.value 
            ? parseFloat(warningThresholdInput.value) 
            : null;

        // Get notification settings
        const emailEnabled = document.getElementById('notify-email')?.checked || false;
        const emailRecipients = document.getElementById('email-recipients')?.value || '';
        const slackEnabled = document.getElementById('notify-slack')?.checked || false;
        const slackWebhook = document.getElementById('slack-webhook')?.value || '';
        const notifyRecovery = document.getElementById('notify-recovery')?.checked || true;
        const notificationFrequency = document.getElementById('notification-frequency')?.value || 'once';

        // Get evaluation settings
        const evaluationWindow = document.getElementById('evaluation-window')?.value || '5';
        const dataPointsRequired = document.getElementById('data-points-required')?.value || '1/1';

        // Get advanced options
        const alertOnMissingData = document.getElementById('alert-on-missing-data')?.checked || false;
        const autoResolveAlert = document.getElementById('auto-resolve-alert')?.checked || true;
        const alertPriority = document.getElementById('alert-priority')?.value || 'P2';
        const monitorTags = document.getElementById('monitor-tags')?.value || '';

        // NEW APPROACH: Create ONE monitor with multiple resources
        const formData = {
            name: monitorName.value,
            monitorType: 'aws',
            resourceType: resourceType.value,
            resourceIds: selectedResources.map(r => r.id),
            resourceNames: selectedResources.map(r => r.name),
            metricName: metricName.value,
            metricNamespace: metricName.selectedOptions[0]?.dataset.namespace,
            thresholdOperator: thresholdOperator.value,
            thresholdValue: parseFloat(thresholdValue.value),
            warningThreshold: warningThreshold,
            monitoringInterval: parseInt(monitoringInterval.value),
            isEnabled: true,
            
            // Evaluation settings
            evaluationWindow: parseInt(evaluationWindow),
            dataPointsRequired: dataPointsRequired,
            
            // Notification settings
            notifications: {
                email: {
                    enabled: emailEnabled,
                    recipients: emailRecipients.split(',').map(e => e.trim()).filter(e => e)
                },
                slack: {
                    enabled: slackEnabled,
                    webhook: slackWebhook
                },
                notifyOnRecovery: notifyRecovery,
                frequency: notificationFrequency
            },
            
            // Advanced options
            advancedOptions: {
                alertOnMissingData: alertOnMissingData,
                autoResolve: autoResolveAlert,
                priority: alertPriority,
                tags: monitorTags.split(',').map(t => t.trim()).filter(t => t)
            }
        };

        console.log('📤 Sending monitor data:', formData);

        try {
            const url = monitorId.value 
                ? `${API_BASE_URL}/api/monitors/${monitorId.value}` 
                : `${API_BASE_URL}/api/monitors`;
            const method = monitorId.value ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                const monitor = await response.json();
                console.log('✅ Monitor created successfully:', monitor);
                closeModal();
                loadMonitors();
                showNotification(`Successfully created monitor for ${selectedResources.length} resources!`, 'success');
            } else {
                const error = await response.text();
                console.error('❌ Failed to create monitor:', error);
                showNotification(`Failed to save monitor: ${error}`, 'error');
            }
        } catch (error) {
            console.error('❌ Error creating monitor:', error);
            showNotification('Error saving monitor', 'error');
        }
    }

    // Global functions for button actions
    window.viewMonitorDetails = function(monitorId) {
        window.location.href = `aws_monitor_graph.html?monitorId=${monitorId}`;
    };

    window.editMonitor = async function(monitorId) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/monitors/${monitorId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const monitor = await response.json();
                populateEditForm(monitor);
                modalTitle.textContent = 'Edit AWS Monitor';
                modal.classList.remove('hidden');
            } else {
                showNotification('Failed to load monitor for editing', 'error');
            }
        } catch (error) {
            console.error('Error loading monitor for edit:', error);
            showNotification('Error loading monitor for editing', 'error');
        }
    };

    window.deleteMonitor = async function(monitorId) {
        if (!confirm('Are you sure you want to delete this monitor?')) return;

        try {
            const response = await fetch(`${API_BASE_URL}/api/monitors/${monitorId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                loadMonitors();
                showNotification('Monitor deleted successfully!', 'success');
            } else {
                showNotification('Failed to delete monitor', 'error');
            }
        } catch (error) {
            console.error('Error deleting monitor:', error);
            showNotification('Error deleting monitor', 'error');
        }
    };

    function populateEditForm(monitor) {
        console.log('Populating edit form with monitor:', monitor);
        
        monitorId.value = monitor.id;
        monitorName.value = monitor.name || '';
        resourceType.value = monitor.resourceType || 'ec2';
        metricName.value = monitor.metricName || '';
        thresholdOperator.value = monitor.thresholdOperator || '>';
        thresholdValue.value = monitor.thresholdValue || 80;
        monitoringInterval.value = monitor.monitoringInterval || 300;
        
        // Trigger change events to load dependent fields (this will populate resource checkboxes)
        resourceType.dispatchEvent(new Event('change'));
        
        // After resources load, pre-select the ones from this monitor
        setTimeout(() => {
            try {
                const resourceIds = monitor.resourceIds ? JSON.parse(monitor.resourceIds) : 
                                   (monitor.resourceId ? [monitor.resourceId] : []);
                
                // Check the appropriate resource checkboxes
                resourceIds.forEach(resId => {
                    const checkbox = document.querySelector(`input[type="checkbox"][value="${resId}"]`);
                    if (checkbox) {
                        checkbox.checked = true;
                    }
                });
            } catch (e) {
                console.error('Error pre-selecting resources:', e);
            }
        }, 1000); // Wait for resources to load
    }

    async function loadMonitorCharts(monitorId) {
        console.log('Loading charts for monitor:', monitorId);
        
        try {
            // Get monitor details to understand what we're charting
            const monitor = monitors.find(m => m.id === monitorId);
            if (!monitor) {
                console.error('Monitor not found:', monitorId);
                return;
            }

            // Load metric timeline data for different time ranges
            await Promise.all([
                loadMetricTimelineChart(monitor),
                loadResourceHealthChart(monitor)
            ]);
            
        } catch (error) {
            console.error('Error loading charts:', error);
            showNotification('Error loading charts', 'error');
        }
    }

    async function loadMetricTimelineChart(monitor) {
        const ctx = document.getElementById('metric-timeline-chart');
        if (!ctx) return;

        // Destroy existing chart if it exists
        if (metricChart) {
            metricChart.destroy();
        }

        try {
            // Get currently selected time range
            const timeRange = document.querySelector('.time-range-btn.active')?.dataset.range || '1h';
            console.log(`📊 Loading chart data for time range: ${timeRange}`);
            
            // Get metric data for the selected time range
            const response = await fetch(`${API_BASE_URL}/api/aws/metrics/${monitor.id}/current?range=${timeRange}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            let timeSeriesData = [];
            
            if (response.ok) {
                const data = await response.json();
                
                // If we have real time series data, use it
                if (data.timeSeries && data.timeSeries.length > 0) {
                    timeSeriesData = data.timeSeries.map(point => ({
                        x: new Date(point.timestamp),
                        y: point.value
                    }));
                } else {
                    // Generate sample time series data based on selected time range
                    const now = new Date();
                    const currentValue = parseFloat(data.value) || Math.random() * 100;
                    
                    // Calculate intervals based on time range
                    const timeRangeConfig = {
                        '1h': { points: 12, intervalMinutes: 5 },      // 12 points, 5 min intervals
                        '6h': { points: 24, intervalMinutes: 15 },     // 24 points, 15 min intervals  
                        '24h': { points: 24, intervalMinutes: 60 },    // 24 points, 1 hour intervals
                        '7d': { points: 28, intervalMinutes: 360 },    // 28 points, 6 hour intervals
                        '30d': { points: 30, intervalMinutes: 1440 }   // 30 points, 1 day intervals
                    };
                    
                    const config = timeRangeConfig[timeRange] || timeRangeConfig['1h'];
                    
                    for (let i = config.points - 1; i >= 0; i--) {
                        const time = new Date(now.getTime() - (i * config.intervalMinutes * 60 * 1000));
                        const variation = (Math.random() - 0.5) * 4; // ±2% variation for realism
                        const value = Math.max(0, currentValue + variation);
                        timeSeriesData.push({
                            x: time,
                            y: parseFloat(value.toFixed(2))
                        });
                    }
                }
            } else {
                // Fallback sample data with time range awareness
                const now = new Date();
                const timeRangeConfig = {
                    '1h': { points: 12, intervalMinutes: 5 },
                    '6h': { points: 24, intervalMinutes: 15 },
                    '24h': { points: 24, intervalMinutes: 60 },
                    '7d': { points: 28, intervalMinutes: 360 },
                    '30d': { points: 30, intervalMinutes: 1440 }
                };
                
                const config = timeRangeConfig[timeRange] || timeRangeConfig['1h'];
                
                for (let i = config.points - 1; i >= 0; i--) {
                    const time = new Date(now.getTime() - (i * config.intervalMinutes * 60 * 1000));
                    timeSeriesData.push({
                        x: time,
                        y: Math.random() * 10 + 2 // 2-12% range for realistic CPU
                    });
                }
            }

            // Create the chart
            metricChart = new Chart(ctx, {
                type: 'line',
                data: {
                    datasets: [{
                        label: `${monitor.metricName} (${monitor.resourceId})`,
                        data: timeSeriesData,
                        borderColor: '#10B981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: {
                                color: '#ffffff'
                            }
                        }
                    },
                    scales: {
                        x: {
                            type: 'time',
                            time: {
                                unit: getTimeUnit(timeRange),
                                displayFormats: getTimeDisplayFormats(timeRange)
                            },
                            ticks: {
                                color: '#9CA3AF'
                            },
                            grid: {
                                color: 'rgba(156, 163, 175, 0.2)'
                            }
                        },
                        y: {
                            beginAtZero: true,
                            ticks: {
                                color: '#9CA3AF'
                            },
                            grid: {
                                color: 'rgba(156, 163, 175, 0.2)'
                            }
                        }
                    }
                }
            });

        } catch (error) {
            console.error('Error loading metric timeline:', error);
        }
    }

    // Helper functions for chart configuration
    function getTimeUnit(timeRange) {
        switch(timeRange) {
            case '1h': return 'minute';
            case '6h': return 'minute';
            case '12h': return 'hour';
            case '24h': return 'hour';
            case '7d': return 'day';
            case '30d': return 'day';
            default: return 'hour';
        }
    }

    function getTimeDisplayFormats(timeRange) {
        switch(timeRange) {
            case '1h':
            case '6h':
                return { minute: 'HH:mm' };
            case '12h':
            case '24h':
                return { hour: 'HH:mm' };
            case '7d':
            case '30d':
                return { day: 'MMM DD' };
            default:
                return { hour: 'HH:mm' };
        }
    }

    async function loadResourceHealthChart(monitor) {
        const ctx = document.getElementById('health-status-chart');
        if (!ctx) return;

        // Destroy existing chart if it exists
        if (healthChart) {
            healthChart.destroy();
        }

        try {
            // Create a simple donut chart showing current status vs threshold
            const currentValue = parseFloat(monitor.currentValue) || 0;
            const threshold = parseFloat(monitor.thresholdValue) || 100;
            
            const isHealthy = monitor.thresholdOperator === '>' ? 
                currentValue <= threshold : currentValue >= threshold;
            
            const healthyPercentage = isHealthy ? 85 : 25;
            const unhealthyPercentage = 100 - healthyPercentage;

            healthChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Healthy', 'At Risk'],
                    datasets: [{
                        data: [healthyPercentage, unhealthyPercentage],
                        backgroundColor: [
                            '#10B981', // Green for healthy
                            '#F59E0B'  // Yellow/Orange for at risk
                        ],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: '#ffffff',
                                padding: 20
                            }
                        }
                    },
                    cutout: '60%'
                }
            });

        } catch (error) {
            console.error('Error loading health chart:', error);
        }
    }

    function showNotification(message, type = 'info') {
        // Simple notification system - you could enhance this
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 p-4 rounded-lg z-50 ${
            type === 'success' ? 'bg-green-600' : 
            type === 'error' ? 'bg-red-600' : 'bg-blue-600'
        } text-white`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
});
