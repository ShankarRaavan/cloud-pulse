document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM fully loaded and parsed');
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    // --- Main Page Elements ---
    const monitorsTbody = document.getElementById('monitors-tbody');
    const addMonitorBtn = document.getElementById('add-monitor-btn');

    // --- Unified Modal Elements ---
    const modal = document.getElementById('add-monitor-modal');
    const closeModalBtn = modal.querySelector('.close-btn');
    const modalTitle = modal.querySelector('#modal-title');
    const form = document.getElementById('add-monitor-form');
    const stepper = modal.querySelector('.stepper');
    const steps = modal.querySelectorAll('.step');
    const accordionItems = modal.querySelectorAll('.accordion-item');
    const accordionHeaders = modal.querySelectorAll('.accordion-header');

    // --- Form Input References ---
    const monitorId = document.createElement('input');
    monitorId.type = 'hidden';
    form.prepend(monitorId);

    // --- Event Listeners ---
    addMonitorBtn.addEventListener('click', openModalForCreate);
    closeModalBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (event) => {
        if (event.target == modal) closeModal();
    });

    accordionHeaders.forEach((header, index) => {
        header.addEventListener('click', () => toggleAccordion(index));
    });

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        saveMonitor();
    });
    
    modal.querySelector('#cancel-btn').addEventListener('click', closeModal);
    modal.querySelector('#test-connection-btn').addEventListener('click', testConnection);

    // --- State Management ---
    let currentStep = 0;
    let credentials = [];

    // --- Core Functions ---
    function openModalForCreate() {
        console.log('Add Monitor button clicked, opening modal...');
        form.reset();
        monitorId.value = '';
        modalTitle.textContent = 'Add New Synthetic Monitor';
        currentStep = 0;
        updateStepperAndAccordion();
        populateAuthFields();
        clearNotificationChannels();
        updateNotificationSummary(); // Update summary after clearing
        modal.style.display = 'block';
        fetchAndPopulateCredentials();
    }

    function closeModal() {
        modal.style.display = 'none';
    }

    function updateStepperAndAccordion() {
        steps.forEach((step, index) => {
            step.classList.toggle('active', index === currentStep);
        });
        accordionItems.forEach((item, index) => {
            const content = item.querySelector('.accordion-content');
            const isActive = index === currentStep;
            item.classList.toggle('active', isActive);
            content.style.display = isActive ? 'block' : 'none';
        });
    }

    function toggleAccordion(index) {
        currentStep = index;
        updateStepperAndAccordion();
    }

    async function fetchAndPopulateCredentials() {
        try {
            const response = await fetch('/api/credentials', { headers: { 'Authorization': `Bearer ${token}` } });
            if (response.ok) {
                credentials = await response.json();
                // This function can be called again to refresh dropdowns if needed
            }
        } catch (error) {
            console.error('Error fetching credentials:', error);
        }
    }

    function populateAuthFields() {
        const authType = modal.querySelector('#auth-type').value;
        const authFieldsContainer = modal.querySelector('#auth-fields');
        authFieldsContainer.innerHTML = ''; // Clear previous fields

        let manageCredentialsBtnHtml = `
            <div class="form-group">
                <button type="button" id="manage-credentials-inline-btn" class="btn btn-secondary" style="width: auto; padding: 8px 12px; font-size: 0.9rem;">+ Manage Credentials</button>
            </div>
        `;

        switch (authType) {
            case 'BASIC':
                authFieldsContainer.innerHTML = `
                    <div class="form-group"><label>Username</label><input type="text" id="auth-username"></div>
                    <div class="form-group"><label>Password</label><input type="password" id="auth-password"></div>
                `;
                break;
            case 'BEARER':
                authFieldsContainer.innerHTML = `
                    <div class="form-group"><label>Bearer Token (Manual)</label><input type="text" id="auth-bearer-token"></div>
                    <div class="form-group">
                        <label>Credential for Auto-Refresh</label>
                        <select id="auth-credential-id">${getCredentialOptions()}</select>
                    </div>
                    ${manageCredentialsBtnHtml}
                `;
                break;
            case 'STORED_CREDENTIAL':
                 authFieldsContainer.innerHTML = `
                    <div class="form-group">
                        <label>Stored Credential</label>
                        <select id="auth-credential-id">${getCredentialOptions()}</select>
                    </div>
                    ${manageCredentialsBtnHtml}
                `;
                break;
            case 'PASSWORD_GRANT':
                authFieldsContainer.innerHTML = `
                    <div class="form-group"><label>Client ID</label><input type="text" id="auth-client-id"></div>
                    <div class="form-group"><label>Username</label><input type="text" id="auth-username"></div>
                    <div class="form-group"><label>Password</label><input type="password" id="auth-password"></div>
                    <div class="form-group"><label>Token URL</label><input type="url" id="auth-token-url"></div>
                    <div class="form-group"><label>Scopes (comma-separated)</label><input type="text" id="auth-scopes"></div>
                `;
                break;
            case 'CLIENT_CREDENTIALS':
                authFieldsContainer.innerHTML = `
                    <div class="form-group"><label>Client ID</label><input type="text" id="auth-client-id"></div>
                    <div class="form-group"><label>Client Secret</label><input type="password" id="auth-client-secret"></div>
                    <div class="form-group"><label>Token URL</label><input type="url" id="auth-token-url"></div>
                    <div class="form-group"><label>Scopes (comma-separated)</label><input type="text" id="auth-scopes"></div>
                `;
                break;
        }
        
        const manageBtn = document.getElementById('manage-credentials-inline-btn');
        if (manageBtn) {
            manageBtn.addEventListener('click', openInlineCredentialModal);
        }
    }
    
    modal.querySelector('#auth-type').addEventListener('change', populateAuthFields);

    function getCredentialOptions(selectedId = '') {
        let options = '<option value="">-- Select a Credential --</option>';
        credentials.forEach(cred => {
            options += `<option value="${cred.id}" ${cred.id === selectedId ? 'selected' : ''}>${cred.name}</option>`;
        });
        return options;
    }

    function buildMonitorData() {
        // Get notification channels data
        const notificationChannels = getNotificationChannelsData();
        
        // Get selected charts from checkboxes
        const chartCheckboxes = document.querySelectorAll('input[name="charts-to-track"]:checked');
        const selectedCharts = Array.from(chartCheckboxes).map(cb => cb.value);

        const monitorData = {
            name: modal.querySelector('#monitor-name').value,
            url: modal.querySelector('#monitor-url').value,
            method: modal.querySelector('#monitor-method').value,
            customHeaders: modal.querySelector('#monitor-headers').value,
            requestBody: modal.querySelector('#monitor-body').value,
            monitoringInterval: parseInt(modal.querySelector('#monitor-interval').value, 10),
            region: modal.querySelector('#monitor-region').value,
            authType: modal.querySelector('#auth-type').value,
            retryCount: parseInt(modal.querySelector('#retry-count').value, 10),
            requestTimeout: parseInt(modal.querySelector('#request-timeout').value, 10),
            alertThreshold: parseInt(modal.querySelector('#alert-threshold').value, 10),
            Notifications: notificationChannels, // Backend expects 'Notifications' with capital N
            chartsToTrack: selectedCharts
        };
        
        console.log('=== SAVING MONITOR ===');
        console.log('Notification channels to save:', notificationChannels);
        console.log('Full monitor data:', JSON.stringify(monitorData, null, 2));

        const authType = monitorData.authType;
        if (authType === 'BEARER' || authType === 'STORED_CREDENTIAL') {
            monitorData.credentialId = modal.querySelector('#auth-credential-id')?.value || null;
        }
        if (authType === 'BEARER') {
             monitorData.bearerToken = modal.querySelector('#auth-bearer-token')?.value || null;
        }
        // Add logic for other auth types
        return monitorData;
    }

    async function saveMonitor() {
        // Validate notification channels if any are selected
        const validation = validateNotificationChannels();
        if (!validation.isValid) {
            alert('Please fix the following errors:\n' + validation.errors.join('\n'));
            return;
        }
        
        const id = monitorId.value;
        const isEditing = !!id;
        const monitorData = buildMonitorData();
        
        // Backend expects notificationIds, not Notifications
        // Convert notification channels to IDs by creating/getting them first
        const notificationChannels = monitorData.Notifications || [];
        delete monitorData.Notifications; // Remove this field
        
        try {
            // Step 1: Create/get notification IDs
            const notificationIds = await createOrGetNotificationIds(notificationChannels);
            console.log('Notification IDs to save:', notificationIds);
            
            // Step 2: Add notificationIds to monitor data
            monitorData.notificationIds = notificationIds;
            
            console.log('Final monitor data to save:', JSON.stringify(monitorData, null, 2));

            // Step 3: Save the monitor
            const url = isEditing ? `/api/monitors/${id}` : '/api/monitors';
            const method = isEditing ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(monitorData)
            });

            if (response.ok) {
                closeModal();
                fetchMonitors();
            } else {
                const errorData = await response.json();
                alert(`Failed to save monitor: ${errorData.message}`);
            }
        } catch (error) {
            console.error('Error saving monitor:', error);
            alert(`Error saving monitor: ${error.message}`);
        }
    }
    
    // Create or get notification IDs from notification channels
    async function createOrGetNotificationIds(channels) {
        if (!channels || channels.length === 0) return [];
        
        const notificationIds = [];
        
        for (const channel of channels) {
            try {
                // Check if notification already exists
                const existingResponse = await fetch('/api/notifications', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (existingResponse.ok) {
                    const existingNotifications = await existingResponse.json();
                    
                    // Find matching notification
                    const existing = existingNotifications.find(n => 
                        n.type === channel.type && 
                        JSON.parse(n.config).target === channel.target
                    );
                    
                    if (existing) {
                        notificationIds.push(existing.id);
                        console.log('Found existing notification:', existing.id);
                        continue;
                    }
                }
                
                // Create new notification
                const createResponse = await fetch('/api/notifications', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}` 
                    },
                    body: JSON.stringify({
                        type: channel.type,
                        config: JSON.stringify({ target: channel.target })
                    })
                });
                
                if (createResponse.ok) {
                    const newNotification = await createResponse.json();
                    notificationIds.push(newNotification.id);
                    console.log('Created new notification:', newNotification.id);
                } else {
                    console.error('Failed to create notification:', await createResponse.text());
                }
                
            } catch (error) {
                console.error('Error processing notification:', error);
            }
        }
        
        return notificationIds;
    }

    async function testConnection() {
        const monitorData = buildMonitorData();
        let effectiveToken = monitorData.bearerToken;

        if (!effectiveToken && monitorData.credentialId) {
            // On-demand token refresh for testing
            try {
                const response = await fetch(`/api/monitors/refresh-token`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ credentialId: monitorData.credentialId })
                });
                const result = await response.json();
                if (response.ok) {
                    effectiveToken = result.bearerToken;
                    alert(`Token refreshed successfully. Last refreshed: ${new Date().toLocaleTimeString()}`);
                } else {
                    throw new Error(result.message || 'Failed to refresh token');
                }
            } catch (error) {
                alert(`Token refresh failed: ${error.message}`);
                return;
            }
        }

        if (!monitorData.url) {
            alert('Please provide a URL to test.');
            return;
        }

        try {
            const start = Date.now();
            const headers = monitorData.customHeaders ? JSON.parse(monitorData.customHeaders) : {};
            if (effectiveToken) {
                headers['Authorization'] = `Bearer ${effectiveToken}`;
            }

            const response = await fetch(monitorData.url, {
                method: monitorData.method,
                headers: headers,
                body: monitorData.requestBody || null
            });
            const latency = Date.now() - start;

            alert(`Test Result:\nStatus: ${response.status}\nLatency: ${latency}ms\nSuccess: ${response.ok}`);

        } catch (error) {
            alert(`Test failed: ${error.message}`);
        }
    }

    async function fetchMonitors() {
        try {
            const response = await fetch('/api/monitors', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const monitors = await response.json();
                renderMonitors(monitors);
            } else if (response.status === 401 || response.status === 403) {
                localStorage.removeItem('token');
                window.location.href = 'index.html';
            } else {
                monitorsTbody.innerHTML = '<tr><td colspan="10" style="text-align:center; color: #ef4444;">Error loading monitors. Please refresh the page.</td></tr>';
            }
        } catch (error) {
            console.error('Error fetching monitors:', error);
            monitorsTbody.innerHTML = '<tr><td colspan="10" style="text-align:center; color: #ef4444;">Error loading monitors. Please check your connection.</td></tr>';
        }
    }

    function renderMonitors(monitors) {
        monitorsTbody.innerHTML = '';
        const httpMonitors = monitors.filter(m => m.monitorType !== 'aws');

        if (httpMonitors.length === 0) {
            monitorsTbody.innerHTML = '<tr><td colspan="10" style="text-align:center;">No monitors configured yet.</td></tr>';
            return;
        }

        httpMonitors.forEach(monitor => {
            console.log('monitor:', monitor);
            const row = document.createElement('tr');
            const lastResult = monitor.historyRecords?.[0];
            const status = lastResult?.status || 'Pending';
            
            const isHealthy = status.toLowerCase() === 'success';
            const statusClass = isHealthy ? 'healthy' : 'unhealthy';
            const statusText = isHealthy ? 'Healthy' : 'Unhealthy';
            
            row.innerHTML = `
                <td>
                    <div class="status-indicator ${statusClass}" title="${statusText}">
                        <i class="fas fa-circle"></i>
                    </div>
                </td>
                <td>${monitor.name}</td>
                <td class="url-cell" title="${monitor.url}">${monitor.url}</td>
                <td>${monitor.method}</td>
                <td>${lastResult?.statusCode || 'N/A'}</td>
                <td>${lastResult?.responseTime || 'N/A'}</td>
                <td>${monitor.errorCounts?.['4XX'] || 0}</td>
                <td>${monitor.errorCounts?.['5XX'] || 0}</td>
                <td>${lastResult ? new Date(lastResult.createdAt).toLocaleString() : 'N/A'}</td>
                <td>
                    <div class="flex space-x-2">
                        <button onclick="window.location.href='synthetic_graph.html?monitorId=${monitor.id}'" class="action-btn" title="View Graph">
                            <i class="fas fa-chart-line text-blue-400 hover:text-blue-300"></i>
                        </button>
                        <button class="action-btn edit-monitor-btn" data-id="${monitor.id}">
                            <i class="fas fa-edit text-yellow-400 hover:text-yellow-300"></i>
                        </button>
                        <button class="action-btn delete-monitor-btn" data-id="${monitor.id}">
                            <i class="fas fa-trash text-red-400 hover:text-red-300"></i>
                        </button>
                    </div>
                </td>
            `;
            monitorsTbody.appendChild(row);
        });

        document.querySelectorAll('.edit-monitor-btn').forEach(btn => btn.addEventListener('click', (e) => {
            openModalForEdit(e.target.closest('.edit-monitor-btn').dataset.id);
        }));
        document.querySelectorAll('.delete-monitor-btn').forEach(btn => btn.addEventListener('click', (e) => {
            deleteMonitor(e.target.closest('.delete-monitor-btn').dataset.id);
        }));
    }

    async function openModalForEdit(id) {
        await fetchAndPopulateCredentials(); // Fetch credentials before populating the form

        const response = await fetch('/api/monitors', { headers: { 'Authorization': `Bearer ${token}` } });
        const monitors = await response.json();
        const monitor = monitors.find(m => m.id === id);

        if (monitor) {
            form.reset();
            monitorId.value = monitor.id;
            modalTitle.textContent = 'Edit Synthetic Monitor';
            
            modal.querySelector('#monitor-name').value = monitor.name;
            modal.querySelector('#monitor-url').value = monitor.url;
            modal.querySelector('#monitor-method').value = monitor.method;
            modal.querySelector('#monitor-headers').value = monitor.customHeaders || '';
            modal.querySelector('#monitor-body').value = monitor.requestBody || '';
            modal.querySelector('#monitor-interval').value = monitor.monitoringInterval;
            modal.querySelector('#monitor-region').value = monitor.region;
            modal.querySelector('#auth-type').value = monitor.authType;
            modal.querySelector('#retry-count').value = monitor.retryCount || 0;
            const timeoutValue = monitor.requestTimeout || 30;
            modal.querySelector('#request-timeout').value = timeoutValue;
            modal.querySelector('#timeout-value').textContent = `${timeoutValue}s`;
            modal.querySelector('#alert-threshold').value = monitor.alertThreshold || 1;

            populateAuthFields();

            if (monitor.authType === 'BEARER' || monitor.authType === 'STORED_CREDENTIAL') {
                modal.querySelector('#auth-credential-id').value = monitor.credentialId;
            }
            if (monitor.authType === 'BEARER') {
                modal.querySelector('#auth-bearer-token').value = monitor.bearerToken || '';
            }
            
            // Load notification channels
            console.log('Full Monitor data:', JSON.stringify(monitor, null, 2));
            console.log('All monitor keys:', Object.keys(monitor));
            
            clearNotificationChannels();
            
            // Backend uses 'Notifications' array with notification objects
            let notifications = monitor.Notifications || [];
            
            console.log('Found Notifications array:', notifications);
            
            // Convert notification objects to channel format
            const channels = notifications.map(notification => {
                let config = notification.config;
                if (typeof config === 'string') {
                    try {
                        config = JSON.parse(config);
                    } catch (e) {
                        console.error('Failed to parse notification config:', e);
                        config = {};
                    }
                }
                
                return {
                    type: notification.type,
                    target: config.target || config.email || config.webhook || config.url || ''
                };
            });
            
            console.log('Converted to channels:', channels);
            
            if (channels && channels.length > 0) {
                console.log('Calling loadNotificationChannels with:', channels);
                loadNotificationChannels(channels);
            } else {
                console.log('No notification channels found');
                // Still update summary to show empty state
                updateNotificationSummary();
            }
            
            // Load selected charts
            if (monitor.chartsToTrack && monitor.chartsToTrack.length > 0) {
                document.querySelectorAll('input[name="charts-to-track"]').forEach(cb => {
                    cb.checked = monitor.chartsToTrack.includes(cb.value);
                });
            }

            currentStep = 0;
            updateStepperAndAccordion();
            modal.style.display = 'block';
        }
    }

    async function deleteMonitor(id) {
        if (!confirm('Are you sure you want to delete this monitor?')) return;
        try {
            const response = await fetch(`/api/monitors/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                fetchMonitors();
            } else {
                alert('Failed to delete monitor.');
            }
        } catch (error) {
            console.error('Error deleting monitor:', error);
        }
    }

    // --- Inline Credential Modal Logic ---
    const inlineCredentialModal = document.getElementById('inline-credential-modal');
    const closeInlineCredentialModalBtn = inlineCredentialModal.querySelector('.close-btn');
    const inlineCredentialForm = document.getElementById('inline-credential-form');
    const inlineCredentialsTbody = document.getElementById('inline-credentials-tbody');
    const inlineCredentialId = document.getElementById('inline-credential-id');
    const inlineCredentialGrantType = document.getElementById('inline-credential-grant-type');
    const inlinePasswordGrantFields = document.getElementById('inline-password-grant-fields');
    const inlineClientCredentialsFields = document.getElementById('inline-client-credentials-fields');

    inlineCredentialGrantType.addEventListener('change', () => {
        const isPasswordGrant = inlineCredentialGrantType.value === 'password_credentials';
        inlinePasswordGrantFields.style.display = isPasswordGrant ? 'block' : 'none';
        inlineClientCredentialsFields.style.display = isPasswordGrant ? 'none' : 'block';
    });

    function openInlineCredentialModal() {
        inlineCredentialModal.style.display = 'block';
        fetchAndRenderInlineCredentials();
    }

    function closeInlineCredentialModal() {
        inlineCredentialModal.style.display = 'none';
    }

    closeInlineCredentialModalBtn.addEventListener('click', closeInlineCredentialModal);

    async function fetchAndRenderInlineCredentials() {
        await fetchAndPopulateCredentials(); // Refresh the main credentials list
        renderInlineCredentialsTable();
    }

    function renderInlineCredentialsTable() {
        inlineCredentialsTbody.innerHTML = '';
        if (credentials.length === 0) {
            inlineCredentialsTbody.innerHTML = '<tr><td colspan="2" style="text-align:center;">No credentials.</td></tr>';
            return;
        }
        credentials.forEach(cred => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${cred.name}</td>
                <td>
                    <button type="button" class="action-btn edit-inline-cred-btn" data-id="${cred.id}">Edit</button>
                    <button type="button" class="action-btn delete-inline-cred-btn" data-id="${cred.id}">Delete</button>
                </td>
            `;
            inlineCredentialsTbody.appendChild(row);
        });
        
        document.querySelectorAll('.edit-inline-cred-btn').forEach(btn => btn.addEventListener('click', (e) => {
            editInlineCredential(e.target.closest('.edit-inline-cred-btn').dataset.id);
        }));
        document.querySelectorAll('.delete-inline-cred-btn').forEach(btn => btn.addEventListener('click', (e) => {
            deleteInlineCredential(e.target.closest('.delete-inline-cred-btn').dataset.id);
        }));
    }

    async function editInlineCredential(id) {
        const credential = credentials.find(c => c.id === id);
        if (credential) {
            inlineCredentialId.value = credential.id;
            document.getElementById('inline-credential-name').value = credential.name;
            inlineCredentialGrantType.value = credential.grantType;
            document.getElementById('inline-credential-token-url').value = credential.tokenUrl;
            document.getElementById('inline-credential-scopes').value = credential.scopes || '';

            const isPasswordGrant = credential.grantType === 'password_credentials';
            inlinePasswordGrantFields.style.display = isPasswordGrant ? 'block' : 'none';
            inlineClientCredentialsFields.style.display = isPasswordGrant ? 'none' : 'block';

            if (isPasswordGrant) {
                document.getElementById('inline-credential-client-id-pg').value = credential.clientId;
                document.getElementById('inline-credential-username').value = credential.username || '';
                document.getElementById('inline-credential-password').value = credential.password || '';
            } else {
                document.getElementById('inline-credential-client-id-cc').value = credential.clientId;
                document.getElementById('inline-credential-client-secret').value = credential.clientSecret || '';
            }
        }
    }

    async function deleteInlineCredential(id) {
        if (!confirm('Are you sure you want to delete this credential?')) return;
        try {
            const response = await fetch(`/api/credentials/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                fetchAndRenderInlineCredentials();
                populateAuthFields();
            } else {
                alert('Failed to delete credential.');
            }
        } catch (error) {
            console.error('Error deleting credential:', error);
        }
    }

    inlineCredentialForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const id = inlineCredentialId.value;
        const isEditing = !!id;
        
        const isPasswordGrant = inlineCredentialGrantType.value === 'password_credentials';
        const data = {
            name: document.getElementById('inline-credential-name').value,
            grantType: inlineCredentialGrantType.value,
            clientId: isPasswordGrant ? document.getElementById('inline-credential-client-id-pg').value : document.getElementById('inline-credential-client-id-cc').value,
            username: isPasswordGrant ? document.getElementById('inline-credential-username').value : null,
            password: isPasswordGrant ? document.getElementById('inline-credential-password').value : null,
            clientSecret: isPasswordGrant ? null : document.getElementById('inline-credential-client-secret').value,
            tokenUrl: document.getElementById('inline-credential-token-url').value,
            scopes: document.getElementById('inline-credential-scopes').value || null
        };

        const url = isEditing ? `/api/credentials/${id}` : '/api/credentials';
        const method = isEditing ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(data)
            });
            if (response.ok) {
                inlineCredentialForm.reset();
                inlineCredentialId.value = '';
                await fetchAndRenderInlineCredentials();
                populateAuthFields(); // Refresh the dropdown in the main modal
            } else {
                alert('Failed to save credential.');
            }
        } catch (error) {
            console.error('Error saving credential:', error);
        }
    });


    // --- Details Drawer Logic ---
    const detailsDrawer = document.getElementById('details-drawer');
    const closeDrawerBtn = detailsDrawer.querySelector('.close-btn');

    closeDrawerBtn.addEventListener('click', () => {
        detailsDrawer.classList.remove('open');
    });

    async function openDetailsDrawer(id) {
        const response = await fetch('/api/monitors', { headers: { 'Authorization': `Bearer ${token}` } });
        const monitors = await response.json();
        const monitor = monitors.find(m => m.id === id);

        if (monitor) {
            const drawerTitle = detailsDrawer.querySelector('#drawer-title');
            const drawerContent = detailsDrawer.querySelector('.drawer-content');
            
            drawerTitle.textContent = monitor.name;

            let credentialName = 'N/A';
            if (monitor.credentialId) {
                const cred = credentials.find(c => c.id === monitor.credentialId);
                if (cred) {
                    credentialName = cred.name;
                }
            }

            let detailsHtml = `
                <h4>Configuration</h4>
                <p><strong>URL:</strong> ${monitor.url}</p>
                <p><strong>Method:</strong> ${monitor.method}</p>
                <p><strong>Interval:</strong> ${monitor.monitoringInterval / 60} minutes</p>
                <p><strong>Authentication:</strong> ${monitor.authType}</p>
            `;

            if (monitor.credentialId) {
                detailsHtml += `<p><strong>Credential:</strong> ${credentialName}</p>`;
                detailsHtml += `<button id="force-refresh-btn" class="btn btn-secondary" style="width: auto; padding: 8px 12px; font-size: 0.9rem; margin-top: 10px;">Force Refresh Token</button>`;
            }

            detailsHtml += `
                <div class="chart-box" style="height: 250px; margin-top: 20px;">
                    <canvas id="drawer-response-time-chart"></canvas>
                </div>
                <div class="chart-box" style="height: 250px; margin-top: 20px;">
                    <canvas id="drawer-status-code-chart"></canvas>
                </div>
            `;

            drawerContent.innerHTML = detailsHtml;

            if (monitor.credentialId) {
                document.getElementById('force-refresh-btn').addEventListener('click', async () => {
                    try {
                        const refreshResponse = await fetch(`/api/monitors/refresh-token`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                            body: JSON.stringify({ credentialId: monitor.credentialId })
                        });
                        if (refreshResponse.ok) {
                            alert('Token refreshed successfully!');
                            fetchMonitors(); // Refresh the main table to show updated status
                        } else {
                            throw new Error('Failed to refresh token');
                        }
                    } catch (error) {
                        alert(error.message);
                    }
                });
            }

            // Render charts in the drawer
            const historyResponse = await fetch(`/api/monitors/${id}/history`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (historyResponse.ok) {
                const history = await historyResponse.json();
                renderDrawerCharts(history);
            }

            detailsDrawer.classList.add('open');
        }
    }

    function renderDrawerCharts(history) {
        const labels = history.map(h => new Date(h.createdAt).toLocaleTimeString());
        const responseTimes = history.map(h => h.responseTime);
        const statusCodes = history.map(h => h.statusCode);

        new Chart(document.getElementById('drawer-response-time-chart'), {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Response Time (ms)',
                    data: responseTimes,
                    borderColor: '#3b82f6',
                    tension: 0.1
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });

        new Chart(document.getElementById('drawer-status-code-chart'), {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Status Code',
                    data: statusCodes,
                    backgroundColor: statusCodes.map(code => code >= 200 && code < 300 ? 'rgba(52, 211, 153, 0.8)' : 'rgba(239, 68, 68, 0.8)')
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    // --- Inline Notification Channels Logic ---
    const toggleNotificationBtn = document.getElementById('toggle-notification-channels');
    const notificationChannelsSection = document.getElementById('notification-channels-inline');
    const channelCheckboxes = document.querySelectorAll('.notification-channel-checkbox');
    
    // Toggle notification channels section
    toggleNotificationBtn.addEventListener('click', function() {
        const isVisible = notificationChannelsSection.style.display !== 'none';
        
        if (isVisible) {
            // Hiding the section
            notificationChannelsSection.style.display = 'none';
            this.classList.remove('active');
            this.innerHTML = '<i class="fas fa-bell"></i> Manage Channels';
        } else {
            // Showing the section - ensure data is still visible
            notificationChannelsSection.style.display = 'block';
            this.classList.add('active');
            this.innerHTML = '<i class="fas fa-bell"></i> Hide Channels';
            
            // Ensure checkboxes and fields remain in their current state
            // Don't reset anything, just show what's already there
            console.log('Showing notification channels section');
        }
    });
    
    // Handle edit buttons
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const channel = this.getAttribute('data-channel');
            
            // Check the checkbox and show the input field
            const checkbox = document.getElementById(`channel-${channel}`);
            if (checkbox && !checkbox.checked) {
                checkbox.checked = true;
                checkbox.dispatchEvent(new Event('change'));
            }
            
            // Focus on the input field
            setTimeout(() => {
                const inputField = document.querySelector(`#${channel}-fields input`);
                if (inputField) {
                    inputField.focus();
                }
            }, 300);
        });
    });
    
    // Handle delete buttons
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const channel = this.getAttribute('data-channel');
            
            // Uncheck the checkbox
            const checkbox = document.getElementById(`channel-${channel}`);
            if (checkbox) {
                checkbox.checked = false;
                checkbox.dispatchEvent(new Event('change'));
            }
            
            // Clear the input field
            const inputField = document.querySelector(`#${channel}-fields input`);
            if (inputField) {
                inputField.value = '';
                inputField.classList.remove('error');
            }
        });
    });
    
    // Handle checkbox changes - show/hide corresponding input fields
    channelCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const channelType = this.value;
            let fieldsId;
            
            switch(channelType) {
                case 'EMAIL':
                    fieldsId = 'email-fields';
                    break;
                case 'SLACK':
                    fieldsId = 'slack-fields';
                    break;
                case 'TEAMS':
                    fieldsId = 'teams-fields';
                    break;
                case 'WEBHOOK':
                    fieldsId = 'webhook-fields';
                    break;
            }
            
            const fieldsDiv = document.getElementById(fieldsId);
            if (this.checked) {
                fieldsDiv.style.display = 'block';
                // Focus on the input field
                setTimeout(() => {
                    const input = fieldsDiv.querySelector('input');
                    if (input) input.focus();
                }, 300);
            } else {
                fieldsDiv.style.display = 'none';
                // Clear the input value when unchecked
                const input = fieldsDiv.querySelector('input');
                if (input) input.value = '';
                updateNotificationSummary();
            }
        });
    });
    
    // Update summary when input values change
    document.querySelectorAll('.channel-input').forEach(input => {
        input.addEventListener('blur', function() {
            updateNotificationSummary();
        });
    });
    
    // Validation for notification inputs
    function validateNotificationChannels() {
        let isValid = true;
        const errors = [];
        
        // Email validation
        const emailCheckbox = document.getElementById('channel-email');
        if (emailCheckbox.checked) {
            const emailInput = document.getElementById('email-addresses');
            const emails = emailInput.value.trim();
            if (!emails) {
                isValid = false;
                errors.push('Email addresses are required');
                emailInput.classList.add('error');
            } else {
                // Validate email format
                const emailList = emails.split(',').map(e => e.trim());
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                const invalidEmails = emailList.filter(e => !emailRegex.test(e));
                if (invalidEmails.length > 0) {
                    isValid = false;
                    errors.push(`Invalid email format: ${invalidEmails.join(', ')}`);
                    emailInput.classList.add('error');
                } else {
                    emailInput.classList.remove('error');
                }
            }
        }
        
        // Slack validation
        const slackCheckbox = document.getElementById('channel-slack');
        if (slackCheckbox.checked) {
            const slackInput = document.getElementById('slack-webhook');
            const slackUrl = slackInput.value.trim();
            if (!slackUrl) {
                isValid = false;
                errors.push('Slack webhook URL is required');
                slackInput.classList.add('error');
            } else if (!slackUrl.startsWith('https://hooks.slack.com')) {
                isValid = false;
                errors.push('Invalid Slack webhook URL');
                slackInput.classList.add('error');
            } else {
                slackInput.classList.remove('error');
            }
        }
        
        // Teams validation
        const teamsCheckbox = document.getElementById('channel-teams');
        if (teamsCheckbox.checked) {
            const teamsInput = document.getElementById('teams-webhook');
            const teamsUrl = teamsInput.value.trim();
            if (!teamsUrl) {
                isValid = false;
                errors.push('Teams webhook URL is required');
                teamsInput.classList.add('error');
            } else if (!teamsUrl.startsWith('https://')) {
                isValid = false;
                errors.push('Invalid Teams webhook URL');
                teamsInput.classList.add('error');
            } else {
                teamsInput.classList.remove('error');
            }
        }
        
        // Webhook validation
        const webhookCheckbox = document.getElementById('channel-webhook');
        if (webhookCheckbox.checked) {
            const webhookInput = document.getElementById('custom-webhook');
            const webhookUrl = webhookInput.value.trim();
            if (!webhookUrl) {
                isValid = false;
                errors.push('Custom webhook URL is required');
                webhookInput.classList.add('error');
            } else if (!webhookUrl.startsWith('http://') && !webhookUrl.startsWith('https://')) {
                isValid = false;
                errors.push('Invalid webhook URL');
                webhookInput.classList.add('error');
            } else {
                webhookInput.classList.remove('error');
            }
        }
        
        return { isValid, errors };
    }
    
    // Get notification channels data
    function getNotificationChannelsData() {
        const channels = [];
        
        // Email
        const emailCheckbox = document.getElementById('channel-email');
        if (emailCheckbox.checked) {
            const emails = document.getElementById('email-addresses').value.trim();
            channels.push({
                type: 'EMAIL',
                target: emails
            });
        }
        
        // Slack
        const slackCheckbox = document.getElementById('channel-slack');
        if (slackCheckbox.checked) {
            const slackUrl = document.getElementById('slack-webhook').value.trim();
            channels.push({
                type: 'SLACK',
                target: slackUrl
            });
        }
        
        // Teams
        const teamsCheckbox = document.getElementById('channel-teams');
        if (teamsCheckbox.checked) {
            const teamsUrl = document.getElementById('teams-webhook').value.trim();
            channels.push({
                type: 'TEAMS',
                target: teamsUrl
            });
        }
        
        // Webhook
        const webhookCheckbox = document.getElementById('channel-webhook');
        if (webhookCheckbox.checked) {
            const webhookUrl = document.getElementById('custom-webhook').value.trim();
            channels.push({
                type: 'WEBHOOK',
                target: webhookUrl
            });
        }
        
        return channels;
    }
    
    // Load notification channels for editing
    function loadNotificationChannels(channels) {
        if (!channels || channels.length === 0) return;
        
        console.log('Loading notification channels:', channels);
        
        // Show the notification section
        notificationChannelsSection.style.display = 'block';
        toggleNotificationBtn.classList.add('active');
        toggleNotificationBtn.innerHTML = '<i class="fas fa-bell"></i> Hide Channels';
        
        channels.forEach(channel => {
            console.log('Loading channel:', channel);
            switch(channel.type) {
                case 'EMAIL':
                    document.getElementById('channel-email').checked = true;
                    document.getElementById('email-fields').style.display = 'block';
                    document.getElementById('email-addresses').value = channel.target;
                    break;
                case 'SLACK':
                    document.getElementById('channel-slack').checked = true;
                    document.getElementById('slack-fields').style.display = 'block';
                    document.getElementById('slack-webhook').value = channel.target;
                    break;
                case 'TEAMS':
                    document.getElementById('channel-teams').checked = true;
                    document.getElementById('teams-fields').style.display = 'block';
                    document.getElementById('teams-webhook').value = channel.target;
                    break;
                case 'WEBHOOK':
                    document.getElementById('channel-webhook').checked = true;
                    document.getElementById('webhook-fields').style.display = 'block';
                    document.getElementById('custom-webhook').value = channel.target;
                    break;
            }
        });
        
        // Update the summary display
        updateNotificationSummary();
    }
    
    // Clear notification channels
    function clearNotificationChannels() {
        channelCheckboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
        document.getElementById('email-fields').style.display = 'none';
        document.getElementById('slack-fields').style.display = 'none';
        document.getElementById('teams-fields').style.display = 'none';
        document.getElementById('webhook-fields').style.display = 'none';
        document.getElementById('email-addresses').value = '';
        document.getElementById('slack-webhook').value = '';
        document.getElementById('teams-webhook').value = '';
        document.getElementById('custom-webhook').value = '';
        notificationChannelsSection.style.display = 'none';
        toggleNotificationBtn.classList.remove('active');
        toggleNotificationBtn.innerHTML = '<i class="fas fa-bell"></i> Manage Channels';
        updateNotificationSummary();
    }
    
    // Update notification summary display
    function updateNotificationSummary() {
        const summaryDiv = document.getElementById('notification-channels-summary');
        if (!summaryDiv) {
            console.error('Summary div not found!');
            return;
        }
        
        const channels = getNotificationChannelsData();
        console.log('Updating summary with channels:', channels);
        
        if (channels.length === 0) {
            summaryDiv.style.display = 'none';
            console.log('No channels to display, hiding summary');
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
            console.log('Added summary item for', name, channel.target);
        });
    }


    // --- Initial Load ---
    fetchMonitors();
    setInterval(fetchMonitors, 30000); // Refresh every 30 seconds

    // --- UI Enhancement Logic ---
    const timeoutSlider = document.getElementById('request-timeout');
    const timeoutValueSpan = document.getElementById('timeout-value');

    timeoutSlider.addEventListener('input', (e) => {
        timeoutValueSpan.textContent = `${e.target.value}s`;
    });
});
