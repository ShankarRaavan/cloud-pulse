document.addEventListener('DOMContentLoaded', function() {
    let token = localStorage.getItem('token');
    if (!token) {
        // Redirect to login if no token found
        window.location.href = '/index.html';
        return;
    }

    // --- Modal Elements ---
    const modal = document.getElementById('aws-credentials-modal');
    const closeModalBtn = modal ? modal.querySelector('.close-btn') : null;

    // --- AWS Card Elements ---
    const addAwsBtn = document.getElementById('add-aws-btn');
    const awsActionsContainer = document.getElementById('aws-actions-container');
    const editAwsBtn = document.getElementById('edit-aws-btn');
    const deleteAwsBtn = document.getElementById('delete-aws-btn');

    // --- Credentials Form Elements ---
    const credentialsForm = document.getElementById('credentials-form');
    const credentialsError = document.getElementById('credentials-error');
    const regionSelect = document.getElementById('aws-default-region');
    const accessKeyInput = document.getElementById('aws-access-key-id');
    const secretKeyInput = document.getElementById('aws-secret-access-key');

    // --- UI State Functions ---
    function openModal() {
        if (modal) modal.style.display = 'block';
    }

    function closeModal() {
        if (modal) modal.style.display = 'none';
        if (credentialsError) credentialsError.textContent = '';
        if (credentialsForm) credentialsForm.reset();
    }

    function updateAwsCardState(hasCredentials) {
        if (hasCredentials) {
            if (addAwsBtn) addAwsBtn.style.display = 'none';
            if (awsActionsContainer) awsActionsContainer.style.display = 'flex';
        } else {
            if (addAwsBtn) addAwsBtn.style.display = 'block';
            if (awsActionsContainer) awsActionsContainer.style.display = 'none';
        }
    }

    // --- Event Listeners ---
    if (addAwsBtn) addAwsBtn.addEventListener('click', openModal);
    if (editAwsBtn) editAwsBtn.addEventListener('click', openModal);
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (modal) {
        window.addEventListener('click', (event) => {
            if (event.target === modal) {
                closeModal();
            }
        });
    }

    if (credentialsForm) {
        credentialsForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            await saveCredentials();
        });
    }

    if (deleteAwsBtn) {
        deleteAwsBtn.addEventListener('click', async () => {
            if (confirm('Are you sure you want to delete your AWS credentials?')) {
                await deleteCredentials();
            }
        });
    }

    // --- API Functions ---
async function populateRegions() {
    if (!regionSelect) return;
    
    // Default AWS regions in case API fails
    const defaultRegions = [
        'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
        'af-south-1', 'ap-east-1', 'ap-south-1', 'ap-northeast-3',
        'ap-northeast-2', 'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1',
        'ca-central-1', 'eu-central-1', 'eu-west-1', 'eu-west-2',
        'eu-south-1', 'eu-west-3', 'eu-north-1', 'me-south-1', 'sa-east-1'
    ];
    
    try {
        const response = await fetch('/api/aws/credentials/regions', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const regions = await response.json();
            regionSelect.innerHTML = regions.map(r => `<option value="${r}">${r}</option>`).join('');
        } else {
            // Use default regions if API fails
            console.warn('AWS regions API not available, using default regions');
            regionSelect.innerHTML = defaultRegions.map(r => `<option value="${r}">${r}</option>`).join('');
        }
    } catch (error) {
        console.error('Error fetching regions:', error);
        // Use default regions as fallback
        regionSelect.innerHTML = defaultRegions.map(r => `<option value="${r}">${r}</option>`).join('');
    }
}

async function loadCredentials() {
    try {
        const response = await fetch('/api/aws-credentials', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const creds = await response.json();
            if (creds && creds.aws_access_key_id) {
                if (accessKeyInput) accessKeyInput.value = creds.aws_access_key_id;
                if (secretKeyInput) {
                    secretKeyInput.value = '';
                    secretKeyInput.placeholder = 'Saved (enter new key to change)';
                }
                if (regionSelect) regionSelect.value = creds.aws_default_region;
                updateAwsCardState(true);
            } else {
                updateAwsCardState(false);
                if (secretKeyInput) secretKeyInput.placeholder = '';
            }
        } else if (response.status === 403 || response.status === 401) {
            window.location.href = 'index.html';
        } else {
            updateAwsCardState(false);
        }
    } catch (error) {
        console.error('Error fetching credentials:', error);
        updateAwsCardState(false);
    }
}

async function saveCredentials() {
    if (!accessKeyInput || !regionSelect) {
        console.error('Required form elements not found');
        return;
    }

    const credsForBackend = {
        aws_access_key_id: accessKeyInput.value,
        aws_default_region: regionSelect.value,
    };

    if (secretKeyInput && secretKeyInput.value) {
        credsForBackend.aws_secret_access_key = secretKeyInput.value;
    }

    try {
        const response = await fetch('/api/aws-credentials', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(credsForBackend)
        });

        if (response.ok) {
            const oldCreds = localStorage.getItem('aws_credentials') ? JSON.parse(localStorage.getItem('aws_credentials')) : null;
            const secretToStore = (secretKeyInput ? secretKeyInput.value : '') || (oldCreds ? oldCreds.secretAccessKey : '');

            localStorage.setItem('aws_credentials', JSON.stringify({
                accessKeyId: credsForBackend.aws_access_key_id,
                secretAccessKey: secretToStore,
                region: credsForBackend.aws_default_region
            }));
            closeModal();
            await loadCredentials();
        } else if (response.status === 403) {
            if (credentialsError) credentialsError.textContent = 'Your session has expired. Please log out and log in again.';
        } else {
            try {
                const errorData = await response.json();
                if (credentialsError) credentialsError.textContent = `Error: ${errorData.detail || 'Failed to save credentials.'}`;
            } catch (e) {
                if (credentialsError) credentialsError.textContent = 'An unexpected error occurred. Please try again.';
            }
        }
    } catch (error) {
        console.error('Error saving credentials:', error);
        if (credentialsError) credentialsError.textContent = 'An unexpected error occurred.';
    }
}

async function deleteCredentials() {
    try {
        const response = await fetch('/api/aws-credentials', {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            // Also remove from localStorage
            localStorage.removeItem('aws_credentials');
            await loadCredentials();
        } else {
            alert('Failed to delete credentials. Please try again.');
        }
    } catch (error) {
        console.error('Error deleting credentials:', error);
        alert('An error occurred while deleting credentials.');
    }
}

    // --- Azure Functionality ---
    const azureModal = document.getElementById('azure-credentials-modal');
    const addAzureBtn = document.getElementById('add-azure-btn');
    const azureActionsContainer = document.getElementById('azure-actions-container');
    const editAzureBtn = document.getElementById('edit-azure-btn');
    const deleteAzureBtn = document.getElementById('delete-azure-btn');
    const azureCredentialsForm = document.getElementById('azure-credentials-form');
    const azureCredentialsError = document.getElementById('azure-credentials-error');

    // Azure Modal Event Listeners
    if (addAzureBtn) {
        addAzureBtn.addEventListener('click', openAzureModal);
    }
    if (editAzureBtn) {
        editAzureBtn.addEventListener('click', openAzureModal);
    }
    if (deleteAzureBtn) {
        deleteAzureBtn.addEventListener('click', deleteAzureCredentials);
    }

    // Test connection button in modal
    const testAzureConnectionBtn = document.getElementById('test-azure-connection-btn');
    if (testAzureConnectionBtn) {
        testAzureConnectionBtn.addEventListener('click', testAzureConnection);
    }

    // Subscription selection variables
    let allSubscriptions = [];
    let selectedSubscriptions = new Set();

    function initializeSubscriptionSelection() {
        const selectAllCheckbox = document.getElementById('select-all-subscriptions');
        const selectedDisplay = document.getElementById('selected-subscriptions-display');
        const dropdownHeader = document.getElementById('dropdown-header');
        const dropdownContent = document.getElementById('dropdown-content');

        if (!selectAllCheckbox || !selectedDisplay || !dropdownHeader || !dropdownContent) {
            console.error('Required subscription elements not found');
            return;
        }

        // Dropdown toggle functionality  
        if (dropdownHeader) {
            dropdownHeader.addEventListener('click', function() {
                const isOpen = dropdownContent.style.display === 'block';
                dropdownContent.style.display = isOpen ? 'none' : 'block';
                dropdownHeader.classList.toggle('active', !isOpen);
            });
        }

        // Close dropdown when clicking outside
        document.addEventListener('click', function(event) {
            if (!event.target.closest('.custom-dropdown')) {
                dropdownContent.style.display = 'none';
                dropdownHeader.classList.remove('active');
            }
        });

        // Select All functionality
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', function() {
                if (this.checked) {
                    selectedSubscriptions = new Set(allSubscriptions.map(sub => sub.subscriptionId));
                    // Check all individual checkboxes
                    document.querySelectorAll('.subscription-checkbox').forEach(cb => {
                        cb.checked = true;
                    });
                } else {
                    selectedSubscriptions.clear();
                    // Uncheck all individual checkboxes
                    document.querySelectorAll('.subscription-checkbox').forEach(cb => {
                        cb.checked = false;
                    });
                }
                updateSelectedSubscriptionsDisplay();
                updateDropdownPlaceholder();
            });
        }

        // Initialize dropdown placeholder
        updateDropdownPlaceholder();
        
        // Load subscriptions when tenant and client info is available
        loadAzureSubscriptions();
    }

    function updateSelectAllState() {
        const selectAllCheckbox = document.getElementById('select-all-subscriptions');
        if (!selectAllCheckbox) {
            console.warn('Select all checkbox not found');
            return;
        }
        
        const totalSubs = allSubscriptions.length;
        const selectedCount = selectedSubscriptions.size;
        
        if (selectedCount === 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        } else if (selectedCount === totalSubs) {
            selectAllCheckbox.checked = true;
            selectAllCheckbox.indeterminate = false;
        } else {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = true;
        }
    }

    function updateSelectedSubscriptionsDisplay() {
        const selectedDisplay = document.getElementById('selected-subscriptions-display');
        selectedDisplay.innerHTML = '';

        selectedSubscriptions.forEach(subId => {
            const subscription = allSubscriptions.find(sub => sub.subscriptionId === subId);
            const displayName = subscription ? subscription.displayName : subId;
            
            const item = document.createElement('div');
            item.className = 'selected-item';
            item.innerHTML = `
                <span title="${displayName} (${subId})">${displayName}</span>
                <span class="remove-btn" onclick="removeSubscription('${subId}')">&times;</span>
            `;
            selectedDisplay.appendChild(item);
        });
    }

    window.removeSubscription = function(subscriptionId) {
        selectedSubscriptions.delete(subscriptionId);
        updateSelectedSubscriptionsDisplay();
        updateDropdownPlaceholder();
        updateSelectAllState();
        
        // Update the checkbox in the dropdown
        const checkbox = document.querySelector(`.subscription-checkbox[value="${subscriptionId}"]`);
        if (checkbox) {
            checkbox.checked = false;
        }
    };

    async function loadAzureSubscriptions() {
        const tenantId = document.getElementById('azure-tenant-id').value;
        const clientId = document.getElementById('azure-client-id').value;
        const clientSecret = document.getElementById('azure-client-secret').value;

        if (!tenantId || !clientId) {
            return; // Cannot load without credentials
        }

        const loadingDiv = document.getElementById('subscription-loading');
        const errorDiv = document.getElementById('subscription-error');
        const dropdownContainer = document.getElementById('subscription-dropdown');

        loadingDiv.style.display = 'block';
        errorDiv.style.display = 'none';
        if (dropdownContainer) {
            dropdownContainer.style.display = 'none';
        }

        try {
            // Send credentials directly to subscriptions endpoint for validation
            const response = await fetch('/api/azure/subscriptions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    tenantId,
                    clientId,
                    clientSecret
                })
            });

            if (response.ok) {
                const subscriptions = await response.json();
                console.log('✅ Received subscriptions:', subscriptions);
                allSubscriptions = subscriptions;
                
                // Populate dropdown content
                populateDropdownWithSubscriptions(subscriptions);

                console.log('✅ Hiding loading div and showing dropdown');
                loadingDiv.style.display = 'none';
                errorDiv.style.display = 'none'; // Ensure error div is hidden
                
                // Show the dropdown container instead of select element
                const dropdownContainer = document.getElementById('subscription-dropdown');
                console.log('Dropdown container found:', !!dropdownContainer);
                if (dropdownContainer) {
                    dropdownContainer.style.display = 'block';
                    console.log('Dropdown container displayed');
                }
                
                // If editing existing credentials, pre-select subscriptions
                loadExistingSubscriptionSelection();
                
            } else {
                console.error('❌ Response not OK:', response.status);
                throw new Error('Failed to load subscriptions');
            }
        } catch (error) {
            console.error('❌ Error loading subscriptions:', error);
            loadingDiv.style.display = 'none';
            errorDiv.style.display = 'block';
            errorDiv.textContent = 'Failed to load subscriptions. Please verify your credentials.';
        }
    }

    function populateDropdownWithSubscriptions(subscriptions) {
        console.log('🔧 Populating dropdown with subscriptions:', subscriptions.length);
        
        // Ensure error message is hidden
        const errorDiv = document.getElementById('subscription-error');
        if (errorDiv) {
            errorDiv.style.display = 'none';
        }
        
        const dropdownContent = document.getElementById('dropdown-content');
        console.log('Dropdown content element found:', !!dropdownContent);
        if (!dropdownContent) {
            console.error('❌ dropdown-content element not found!');
            return;
        }

        // Find the subscription options container
        const subscriptionOptions = document.getElementById('subscription-options');
        if (!subscriptionOptions) {
            console.error('❌ subscription-options element not found!');
            return;
        }

        // Clear existing subscription options
        subscriptionOptions.innerHTML = '';

        // Add subscriptions as options
        subscriptions.forEach(subscription => {
            const option = document.createElement('div');
            option.className = 'dropdown-item subscription-item';
            option.innerHTML = `
                <label class="subscription-checkbox-label">
                    <input type="checkbox" class="subscription-checkbox" value="${subscription.subscriptionId}">
                    <span class="subscription-checkmark"></span>
                    <div class="subscription-content">
                        <span class="subscription-text">${subscription.displayName}</span>
                        <small class="subscription-id">${subscription.subscriptionId}</small>
                    </div>
                </label>
            `;
            
            // Add click handler for individual subscription
            const checkbox = option.querySelector('.subscription-checkbox');
            checkbox.addEventListener('change', function() {
                if (this.checked) {
                    selectedSubscriptions.add(this.value);
                } else {
                    selectedSubscriptions.delete(this.value);
                }
                updateSelectedSubscriptionsDisplay();
                updateDropdownPlaceholder();
                updateSelectAllState();
            });
            
            subscriptionOptions.appendChild(option);
        });

        // Store all subscriptions and reset selections
        allSubscriptions = subscriptions;
        selectedSubscriptions.clear();
        updateSelectedSubscriptionsDisplay();
        updateDropdownPlaceholder();
        updateSelectAllState();
    }

    function updateDropdownPlaceholder() {
        const dropdownPlaceholder = document.getElementById('dropdown-placeholder');
        if (!dropdownPlaceholder) return;

        const count = selectedSubscriptions.size;
        if (count === 0) {
            dropdownPlaceholder.textContent = 'Select subscriptions';
        } else if (count === 1) {
            dropdownPlaceholder.textContent = '1 subscription selected';
        } else {
            dropdownPlaceholder.textContent = `${count} subscriptions selected`;
        }
    }

    function loadExistingSubscriptionSelection() {
        // This will be called when editing existing credentials
        // For now, we'll load from the saved configuration if available
    }

    // Add event listeners to reload subscriptions when credentials change
    function addCredentialChangeListeners() {
        const tenantInput = document.getElementById('azure-tenant-id');
        const clientIdInput = document.getElementById('azure-client-id');
        const clientSecretInput = document.getElementById('azure-client-secret');

        let debounceTimer;
        
        function debounceReload() {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const tenantId = tenantInput.value;
                const clientId = clientIdInput.value;
                const clientSecret = clientSecretInput.value;
                
                // Only reload if we have all required credentials
                if (tenantId && clientId && clientSecret) {
                    console.log('🔄 Debounced reload triggered with complete credentials');
                    loadAzureSubscriptions();
                } else {
                    console.log('⏳ Waiting for complete credentials before loading');
                }
            }, 2000); // Increase to 2 seconds to reduce rapid calls
        }

        tenantInput.addEventListener('input', debounceReload);
        clientIdInput.addEventListener('input', debounceReload);
        clientSecretInput.addEventListener('input', debounceReload);
    }

    // Initialize credential change listeners when modal opens
    setTimeout(() => {
        if (document.getElementById('azure-tenant-id')) {
            addCredentialChangeListeners();
        }
    }, 100);

    // Azure modal close functionality
    if (azureModal) {
        const azureCloseBtn = azureModal.querySelector('.close-btn');
        if (azureCloseBtn) {
            azureCloseBtn.addEventListener('click', closeAzureModal);
        }
        
        window.addEventListener('click', (event) => {
            if (event.target === azureModal) {
                closeAzureModal();
            }
        });
    }

    // Azure form submission
    if (azureCredentialsForm) {
        azureCredentialsForm.addEventListener('submit', saveAzureCredentials);
    }

    function openAzureModal() {
        if (!azureModal) {
            console.error('Azure modal not found');
            return;
        }
        
        azureModal.style.display = 'block';
        if (azureCredentialsError) azureCredentialsError.textContent = '';
        
        // Pre-populate if editing existing credentials
        loadAzureCredentialsForEdit();
        // Initialize subscription handling
        initializeSubscriptionSelection();
    }

    function closeAzureModal() {
        if (azureModal) azureModal.style.display = 'none';
        if (azureCredentialsError) azureCredentialsError.textContent = '';
        if (azureCredentialsForm) azureCredentialsForm.reset();
        
        // Reset subscription selection
        if (typeof selectedSubscriptions !== 'undefined') selectedSubscriptions.clear();
        if (typeof allSubscriptions !== 'undefined') allSubscriptions.length = 0;
        
        const selectedDisplay = document.getElementById('selected-subscriptions-display');
        if (selectedDisplay) selectedDisplay.innerHTML = '';
        
        const selectAllCheckbox = document.getElementById('select-all-subscriptions');
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        }
        
        const subscriptionSelect = document.getElementById('azure-subscription-select');
        if (subscriptionSelect) subscriptionSelect.innerHTML = '';
        
        const loadingDiv = document.getElementById('subscription-loading');
        if (loadingDiv) loadingDiv.style.display = 'none';
        
        const errorDiv = document.getElementById('subscription-error');
        if (errorDiv) errorDiv.style.display = 'none';
        
        const statusDiv = document.getElementById('azure-modal-status');
        if (statusDiv) statusDiv.style.display = 'none';
    }

    function updateAzureCardState(hasCredentials) {
        if (hasCredentials) {
            addAzureBtn.style.display = 'none';
            azureActionsContainer.style.display = 'flex';
        } else {
            addAzureBtn.style.display = 'block';
            azureActionsContainer.style.display = 'none';
        }
    }

    async function saveAzureCredentials(e) {
        e.preventDefault();
        
        const tenantId = document.getElementById('azure-tenant-id').value;
        const clientId = document.getElementById('azure-client-id').value;
        const clientSecret = document.getElementById('azure-client-secret').value;
        const testConnection = true; // Always test connection after saving

        // Validate required fields
        if (!tenantId || !clientId) {
            azureCredentialsError.textContent = 'Please provide Tenant ID and Client ID';
            return;
        }

        if (selectedSubscriptions.size === 0) {
            azureCredentialsError.textContent = 'Please select at least one subscription';
            return;
        }

        // Convert selected subscriptions to array
        const subscriptionIds = Array.from(selectedSubscriptions);

        try {
            const response = await fetch('/api/azure/credentials', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    tenantId,
                    clientId,
                    clientSecret: clientSecret || undefined, // Don't send empty secret when editing
                    subscriptionIds, // Send array of subscription IDs
                    subscriptionNames: subscriptionIds.map(id => {
                        const sub = allSubscriptions.find(s => s.subscriptionId === id);
                        return sub ? sub.displayName : id;
                    })
                })
            });

            if (response.ok) {
                closeAzureModal();
                await loadAzureCredentials(); // Reload to update card state
                
                if (testConnection) {
                    await testAzureConnection();
                } else {
                    alert('Azure credentials saved successfully!');
                }
            } else {
                const error = await response.json();
                azureCredentialsError.textContent = error.message || 'Failed to save credentials';
            }
        } catch (error) {
            console.error('Error saving Azure credentials:', error);
            azureCredentialsError.textContent = 'Network error occurred';
        }
    }

    async function loadAzureCredentials() {
        try {
            const response = await fetch('/api/azure/credentials/status', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                updateAzureCardState(data.configured);
            } else if (response.status === 404) {
                // API endpoint doesn't exist yet, that's OK
                console.log('Azure credentials API not implemented yet');
                updateAzureCardState(false);
            } else {
                console.error('Failed to load Azure credentials status:', response.status);
                updateAzureCardState(false);
            }
        } catch (error) {
            console.error('Error loading Azure credentials:', error);
            updateAzureCardState(false);
        }
    }

    async function loadAzureCredentialsForEdit() {
        try {
            // Load credentials for editing
            const response = await fetch('/api/azure/credentials', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const credentials = await response.json();
                
                const tenantInput = document.getElementById('azure-tenant-id');
                const clientInput = document.getElementById('azure-client-id');
                const secretInput = document.getElementById('azure-client-secret');
                
                if (tenantInput) tenantInput.value = credentials.tenantId || '';
                if (clientInput) clientInput.value = credentials.clientId || '';
                
                // Don't populate the secret for security - set placeholder instead
                if (secretInput) {
                    secretInput.value = '';
                    secretInput.placeholder = 'Saved (enter new secret to change)';
                }
                
                // Load subscriptions first, then pre-select saved ones
                setTimeout(() => {
                    loadAzureSubscriptions().then(() => {
                        if (credentials.subscriptionIds && credentials.subscriptionIds.length > 0) {
                            selectedSubscriptions = new Set(credentials.subscriptionIds);
                            updateSelectedSubscriptionsDisplay();
                            updateSelectAllState();
                            
                            // Update the select element
                            const selectElement = document.getElementById('azure-subscription-select');
                            Array.from(selectElement.options).forEach(option => {
                                option.selected = selectedSubscriptions.has(option.value);
                            });
                        }
                    });
                }, 100);
                
                // Show status indicator in modal
                const statusIndicator = document.getElementById('azure-modal-status');
                const statusDot = statusIndicator.querySelector('.status-dot');
                const statusText = document.getElementById('azure-status-text');
                statusIndicator.style.display = 'flex';
                statusDot.className = 'status-dot connected';
                const subCount = credentials.subscriptionIds ? credentials.subscriptionIds.length : 0;
                statusText.textContent = `Credentials configured (${subCount} subscription${subCount !== 1 ? 's' : ''})`;
            }
        } catch (error) {
            console.error('Error loading Azure credentials for editing:', error);
            // Show error status
            const statusIndicator = document.getElementById('azure-modal-status');
            const statusDot = statusIndicator.querySelector('.status-dot');
            const statusText = document.getElementById('azure-status-text');
            statusIndicator.style.display = 'flex';
            statusDot.className = 'status-dot disconnected';
            statusText.textContent = 'No credentials found';
        }
    }



    async function testAzureConnection() {
        try {
            const response = await fetch('/api/azure/test-connection', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    alert('Azure connection test successful! ✓');
                } else {
                    alert('Azure connection test failed: ' + result.message);
                }
            } else {
                alert('Failed to test Azure connection');
            }
        } catch (error) {
            console.error('Error testing Azure connection:', error);
            alert('Error testing Azure connection');
        }
    }

    async function deleteAzureCredentials() {
        if (!confirm('Are you sure you want to delete Azure credentials? This cannot be undone.')) {
            return;
        }

        try {
            const response = await fetch('/api/azure/credentials', {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                updateAzureCardState(false);
                alert('Azure credentials deleted successfully.');
            } else {
                alert('Failed to delete Azure credentials.');
            }
        } catch (error) {
            console.error('Error deleting Azure credentials:', error);
            alert('An error occurred while deleting Azure credentials.');
        }
    }

    // --- Initial Load ---
    try {
        populateRegions();
        loadCredentials();
        loadAzureCredentials();
    } catch (error) {
        console.error('Error during initial load:', error);
    }
});
