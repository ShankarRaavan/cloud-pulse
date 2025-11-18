// Azure Cost Report JavaScript
document.addEventListener('DOMContentLoaded', function() {
    let charts = {};
    let token = localStorage.getItem('token');
    let isAzureConfigured = false;

    // Check if user is authenticated
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    // Initialize the page
    initializePage();

    async function initializePage() {
        try {
            console.time('⏱️ Total Page Load Time');
            
            await checkAzureConfiguration();
            await loadAzureFilters();
            await loadCostData();
            setupEventListeners();
            
            console.timeEnd('⏱️ Total Page Load Time');
        } catch (error) {
            console.error('Error initializing Azure cost report:', error);
            showError('Failed to initialize Azure cost report');
        }
    }

    async function checkAzureConfiguration() {
        try {
            const response = await fetch('/api/azure/credentials/status', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                isAzureConfigured = data.configured;
                
                const configNotice = document.getElementById('config-notice');
                if (configNotice) {
                    if (isAzureConfigured) {
                        configNotice.style.display = 'none';
                    } else {
                        configNotice.style.display = 'block';
                    }
                }
            } else {
                // Azure service not available yet
                isAzureConfigured = false;
            }
        } catch (error) {
            console.error('Error checking Azure configuration:', error);
            isAzureConfigured = false;
        }
    }

    async function loadCostData(forceRefresh = false) {
        const timePeriod = document.getElementById('time-period').value;
        const subscription = document.getElementById('subscription-filter').value;
        const resourceGroup = document.getElementById('resource-group-filter').value;
        
        console.log('Loading cost data with filters:', { timePeriod, subscription, resourceGroup, forceRefresh });
        
        try {
            if (isAzureConfigured) {
                // Load real Azure cost data
                await loadRealAzureCostData(timePeriod, subscription, resourceGroup, forceRefresh);
            } else {
                // Show zero data when credentials are not configured (like AWS)
                loadZeroData();
            }
        } catch (error) {
            console.error('Error loading cost data:', error);
            // Show zero data on error instead of sample data
            loadZeroData();
        }
    }

    async function loadRealAzureCostData(timePeriod, subscription, resourceGroup, forceRefresh = false) {
        try {
            const fetchStartTime = performance.now();
            
            // If "all" is selected, send null to backend to indicate all subscriptions
            const subscriptionFilter = subscription === 'all' ? null : subscription;
            const resourceGroupFilter = resourceGroup === 'all' ? null : resourceGroup;
            
            console.log('Sending filters to backend:', { 
                timePeriod, 
                subscription: subscriptionFilter, 
                resourceGroup: resourceGroupFilter,
                forceRefresh 
            });
            
            // First try the cost-specific endpoint
            let response = await fetch('/api/azure/cost/all-data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    timePeriod,
                    subscription: subscriptionFilter,
                    resourceGroup: resourceGroupFilter,
                    forceRefresh: forceRefresh
                })
            });

            // If cost endpoint fails, try the main Azure endpoint
            if (!response.ok) {
                console.warn('Cost endpoint failed, trying main Azure endpoints...');
                response = await fetch('/api/azure/cost/summary', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        timePeriod,
                        subscription: subscriptionFilter,
                        resourceGroup: resourceGroupFilter,
                        forceRefresh: forceRefresh
                    })
                });
            }

            if (response.ok) {
                const fetchTime = ((performance.now() - fetchStartTime) / 1000).toFixed(2);
                console.log(`⚡ API Response received in ${fetchTime}s`);
                
                const data = await response.json();
                console.log('✅ Azure cost data received:', data);
                console.log('Summary:', data.summary);
                console.log('Breakdown:', data.breakdown);
                console.log('Number of services in breakdown:', data.breakdown ? data.breakdown.length : 0);

                const renderStartTime = performance.now();
                
                // Update summary cards
                updateSummaryCards(data.summary);

                // Update service breakdown
                updateServiceBreakdown(data.breakdown);
                createServiceCostChart(data.breakdown);

                // Update daily spend chart
                createDailySpendChart(data.daily);
                
                // Update insights section
                if (data.insights) {
                    updateInsightsSection(data.insights);
                }
                
                // Update regional chart
                if (data.regional) {
                    createRegionalChart(data.regional);
                }
                
                const renderTime = ((performance.now() - renderStartTime) / 1000).toFixed(2);
                console.log(`🎨 UI Rendered in ${renderTime}s`);
                console.log(`📊 Total load time: ${((performance.now() - fetchStartTime) / 1000).toFixed(2)}s`);
            } else {
                console.error('❌ Failed to get Azure cost data:', response.status, response.statusText);
                const errorText = await response.text();
                console.error('❌ Error details:', errorText);
                
                // Show error to user
                showError(`Failed to load cost data: ${response.status} - ${response.statusText}`);
                loadZeroData(); // Show zero data on error (like AWS)
            }

        } catch (error) {
            console.error('Error loading real Azure cost data:', error);
            loadZeroData(); // Show zero data on error (like AWS)
        }
    }

    async function loadAzureFilters() {
        try {
            // Load subscriptions
            const subscriptionResponse = await fetch('/api/azure/subscriptions', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (subscriptionResponse.ok) {
                const subscriptions = await subscriptionResponse.json();
                updateSubscriptionFilter(subscriptions);
            }

            // Load resource groups for default subscription
            await loadResourceGroups();
        } catch (error) {
            console.error('Error loading Azure filters:', error);
        }
    }

    // Transform Azure Cost Management API response to expected format for summary
    function transformAzureCostSummary(azureResponse) {
        // Transforming Azure cost summary data
        
        // Check if this is already in the expected format (sample data)
        if (azureResponse.mtdSpend !== undefined) {
            return azureResponse;
        }

        let totalCost = 0;
        
        // Handle Azure Cost Management API response format
        if (azureResponse.properties && azureResponse.properties.rows) {
            // Sum all costs from the Azure response
            azureResponse.properties.rows.forEach(row => {
                if (row[0]) { // Cost value is typically in the first column
                    totalCost += parseFloat(row[0]) || 0;
                }
            });
        }

        // Generate mock forecast and budget data since Azure API doesn't provide these directly
        const forecast = totalCost * 2.2; // Estimate end of month
        const budget = totalCost * 2.5; // Estimated budget
        const prevMtd = totalCost * 0.9; // Estimated previous month
        const change = ((totalCost - prevMtd) / prevMtd) * 100;

        return {
            mtdSpend: totalCost,
            mtdChange: change,
            forecastEom: forecast,
            forecastComparison: prevMtd * 2.2,
            budget: budget,
            budgetVariance: ((totalCost - budget) / budget) * 100,
            anomalies: Math.floor(Math.random() * 3),
            anomalyAmount: Math.floor(Math.random() * 1000)
        };
    }

    // Transform Azure Cost Management API response to expected format for breakdown
    function transformAzureCostBreakdown(azureResponse) {
        // Transforming Azure cost breakdown data
        
        // Check if this is already in the expected format (sample data)
        if (Array.isArray(azureResponse) && azureResponse[0]?.service !== undefined) {
            return azureResponse;
        }

        const services = [];
        
        // Handle Azure Cost Management API response format
        if (azureResponse.properties && azureResponse.properties.rows) {
            azureResponse.properties.rows.forEach(row => {
                const serviceName = row[1] || 'Unknown Service'; // Service name is typically in second column
                const cost = parseFloat(row[0]) || 0; // Cost is typically in first column
                
                if (cost > 0) {
                    services.push({
                        service: serviceName,
                        mtd: cost,
                        prevMtd: cost * 0.9, // Estimated previous month
                        forecast: cost * 2.2, // Estimated forecast
                        budget: cost * 2.5 // Estimated budget
                    });
                }
            });
        }

        return services;
    }

    // Transform Azure Cost Management API response to expected format for daily data
    function transformAzureDailyData(azureResponse) {
        // Transforming Azure daily cost data
        
        // Check if this is already in the expected format (sample data)
        if (azureResponse.labels && azureResponse.datasets) {
            return azureResponse;
        }

        const dailyData = {};
        const dates = [];
        
        // Handle Azure Cost Management API response format
        if (azureResponse.properties && azureResponse.properties.rows) {
            azureResponse.properties.rows.forEach(row => {
                const date = new Date(row[1] || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                const cost = parseFloat(row[0]) || 0;
                const service = row[2] || 'Total';
                
                if (!dates.includes(date)) {
                    dates.push(date);
                }
                
                if (!dailyData[service]) {
                    dailyData[service] = {};
                }
                dailyData[service][date] = cost;
            });
        }

        // Convert to Chart.js format
        const datasets = Object.keys(dailyData).slice(0, 5).map((service, index) => {
            const colors = ['#0078d4', '#005a9e', '#004578', '#40e0d0', '#32cd32'];
            return {
                label: service,
                data: dates.map(date => dailyData[service][date] || 0),
                borderColor: colors[index % colors.length],
                backgroundColor: `${colors[index % colors.length]}1A`, // Add transparency
                tension: 0.4
            };
        });

        return {
            labels: dates,
            datasets: datasets
        };
    }

    function loadZeroData() {
        // Show zero data when credentials are not configured (similar to AWS behavior)
        const zeroSummary = {
            mtdSpend: 0,
            mtdChange: 0,
            forecastEom: 0,
            forecastComparison: 0,
            budget: 0,
            budgetVariance: 0,
            anomalies: 0,
            anomalyAmount: 0
        };

        updateSummaryCards(zeroSummary);

        // Empty service data
        const emptyServiceData = [];

        updateServiceBreakdown(emptyServiceData);
        createServiceCostChart(emptyServiceData);
        createEmptyDailyChart();
        createEmptyRegionChart();
        
        // Clear insights
        updateInsightsSection([]);
    }

    function updateSummaryCards(data) {
        document.getElementById('mtd-spend').textContent = formatCurrency(data.mtdSpend);
        document.getElementById('mtd-change').textContent = `${data.mtdChange.toFixed(1)}%`;
        document.getElementById('mtd-change').className = data.mtdChange > 0 ? 'text-red-400' : 'text-green-400';

        document.getElementById('forecast-eom').textContent = formatCurrency(data.forecastEom);
        document.getElementById('forecast-comparison').textContent = formatCurrency(data.forecastComparison);

        document.getElementById('budget-amount').textContent = formatCurrency(data.budget);
        document.getElementById('budget-status').textContent = `${Math.abs(data.budgetVariance).toFixed(1)}% ${data.budgetVariance < 0 ? 'under' : 'over'}`;
        document.getElementById('budget-status').className = data.budgetVariance < 0 ? 'text-green-400' : 'text-red-400';

        document.getElementById('anomaly-count').textContent = data.anomalies;
        document.getElementById('anomaly-amount').textContent = formatCurrency(data.anomalyAmount);
    }

    function updateServiceBreakdown(services) {
        const tbody = document.getElementById('service-breakdown-body');
        tbody.innerHTML = '';

        services.forEach(service => {
            const row = document.createElement('tr');
            const deltaPercent = ((service.mtd - service.prevMtd) / service.prevMtd * 100).toFixed(1);
            const variance = ((service.mtd - service.budget) / service.budget * 100).toFixed(1);
            
            row.innerHTML = `
                <td class="py-2">${service.service}</td>
                <td class="text-right py-2 num">$${formatCurrency(service.mtd)}</td>
                <td class="text-right py-2 num">$${formatCurrency(service.prevMtd)}</td>
                <td class="text-right py-2 ${deltaPercent > 0 ? 'text-red-400' : 'text-green-400'}">${deltaPercent}%</td>
                <td class="text-right py-2 num">$${formatCurrency(service.forecast)}</td>
                <td class="text-right py-2 num">$${formatCurrency(service.budget)}</td>
                <td class="text-right py-2 ${variance > 0 ? 'text-red-400' : 'text-green-400'}">${variance}%</td>
                <td class="text-right py-2">
                    <div class="spark">
                        ${generateSparkline()}
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    function updateSubscriptionFilter(subscriptions) {
        const select = document.getElementById('subscription-filter');
        
        // Prevent multiple rapid updates
        if (select.dataset.updating === 'true') {
            console.log('Subscription filter update already in progress, skipping...');
            return;
        }
        select.dataset.updating = 'true';
        
        // Preserve current selection
        const currentValue = select.value;
        console.log('Updating subscription filter, preserving selection:', currentValue);
        
        select.innerHTML = '<option value="all">All Subscriptions</option>';
        
        subscriptions.forEach(sub => {
            const option = document.createElement('option');
            option.value = sub.subscriptionId;
            option.textContent = sub.displayName;
            option.style.backgroundColor = '#1e293b';
            option.style.color = '#e2e8f0';
            select.appendChild(option);
        });
        
        // Restore the previous selection if it still exists
        if (currentValue && currentValue !== 'all') {
            const optionExists = Array.from(select.options).some(option => option.value === currentValue);
            if (optionExists) {
                select.value = currentValue;
                console.log('Restored subscription selection:', currentValue);
            }
        }
        
        // Enhance styling after adding options
        setTimeout(enhanceDropdownStyling, 50);
        
        // Clear the updating flag
        select.dataset.updating = 'false';
        console.log('Subscription filter update completed');
    }

    async function loadResourceGroups(subscriptionId = null) {
        try {
            let url = '/api/azure/resource-groups';
            if (subscriptionId && subscriptionId !== 'all') {
                url += `?subscription=${subscriptionId}`;
            }

            const rgResponse = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (rgResponse.ok) {
                const resourceGroups = await rgResponse.json();
                updateResourceGroupFilter(resourceGroups);
                console.log(`Loaded ${resourceGroups.length} resource groups for subscription: ${subscriptionId || 'default'}`);
            } else {
                console.error('Failed to load resource groups:', rgResponse.status);
            }
        } catch (error) {
            console.error('Error loading resource groups:', error);
        }
    }

    function updateResourceGroupFilter(resourceGroups) {
        const select = document.getElementById('resource-group-filter');
        select.innerHTML = '<option value="all">All Resource Groups</option>';
        
        resourceGroups.forEach(rg => {
            const option = document.createElement('option');
            option.value = rg.name;
            option.textContent = rg.name;
            option.style.backgroundColor = '#1e293b';
            option.style.color = '#e2e8f0';
            select.appendChild(option);
        });
        
        // Enhance styling after adding options
        setTimeout(enhanceDropdownStyling, 50);
    }

    function createServiceCostChart(data) {
        const ctx = document.getElementById('service-cost-chart').getContext('2d');
        
        if (charts.serviceCost) {
            charts.serviceCost.destroy();
        }

        // Handle empty data case
        const hasData = data && data.length > 0;
        
        charts.serviceCost = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: hasData ? data.map(item => item.service) : [],
                datasets: [{
                    data: hasData ? data.map(item => item.mtd) : [],
                    backgroundColor: [
                        '#0078d4', '#005a9e', '#004578', '#003152',
                        '#40e0d0', '#32cd32', '#ffa500', '#ff6347'
                    ],
                    borderWidth: 2,
                    borderColor: '#1e293b'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        top: 5,
                        bottom: 5,
                        left: 5,
                        right: 5
                    }
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        align: 'center',
                        labels: {
                            color: '#e2e8f0',
                            padding: 10,
                            usePointStyle: true,
                            font: {
                                size: 10
                            },
                            boxWidth: 10,
                            boxHeight: 10
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.label}: $${formatCurrency(context.parsed)}`;
                            }
                        }
                    }
                }
            }
        });
    }

    function createDailySpendChart(data) {
        const ctx = document.getElementById('daily-spend-chart').getContext('2d');
        
        if (charts.dailySpend) {
            charts.dailySpend.destroy();
        }

        charts.dailySpend = new Chart(ctx, {
            type: 'line',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#e2e8f0'
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: '#94a3b8'
                        },
                        grid: {
                            color: '#374151'
                        }
                    },
                    y: {
                        ticks: {
                            color: '#94a3b8',
                            callback: function(value) {
                                return '$' + formatCurrency(value);
                            }
                        },
                        grid: {
                            color: '#374151'
                        }
                    }
                }
            }
        });
    }

    function createEmptyDailyChart() {
        const ctx = document.getElementById('daily-spend-chart').getContext('2d');
        
        if (charts.dailySpend) {
            charts.dailySpend.destroy();
        }

        const days = [];
        
        charts.dailySpend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: days,
                datasets: []
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#e2e8f0'
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: '#94a3b8'
                        },
                        grid: {
                            color: '#374151'
                        }
                    },
                    y: {
                        ticks: {
                            color: '#94a3b8',
                            callback: function(value) {
                                return '$' + value;
                            }
                        },
                        grid: {
                            color: '#374151'
                        }
                    }
                }
            }
        });
    }

    function createEmptyRegionChart() {
        // Show empty regional chart when no data is available
        const emptyRegionalData = {
            labels: [],
            datasets: []
        };
        
        createRegionalChart(emptyRegionalData);
    }

    function setupEventListeners() {
        // Filter change listeners
        document.getElementById('time-period').addEventListener('change', loadCostData);
        document.getElementById('subscription-filter').addEventListener('change', async function() {
            const selectedSubscription = this.value;
            console.log('Subscription changed to:', selectedSubscription);
            console.log('Current dropdown value before loading:', this.value);
            
            // Load resource groups for selected subscription
            await loadResourceGroups(selectedSubscription);
            
            console.log('Current dropdown value after loading resource groups:', this.value);
            
            // Load cost data for selected subscription
            await loadCostData();
            
            console.log('Current dropdown value after loading cost data:', this.value);
        });
        document.getElementById('resource-group-filter').addEventListener('change', loadCostData);
        
        // Refresh button - Force refresh bypasses cache
        document.getElementById('refresh-btn').addEventListener('click', async () => {
            console.log('🔄 Force refresh - bypassing cache');
            await loadCostData(true); // Pass true to force refresh
        });

        // Export CSV button
        document.getElementById('export-csv-btn').addEventListener('click', exportToCSV);

        // Schedule button
        document.getElementById('schedule-btn').addEventListener('click', () => {
            alert('Scheduled reporting feature will be available soon!');
        });

        // Enhance dropdown styling
        setTimeout(enhanceDropdownStyling, 200);
    }

    function exportToCSV() {
        try {
            const rows = [];
            const headers = ['Service', 'MTD', 'Prev MTD', 'Change %', 'Forecast', 'Budget', 'Variance %'];
            rows.push(headers);

            const tbody = document.getElementById('service-breakdown-body');
            const tableRows = tbody.querySelectorAll('tr');
            
            tableRows.forEach(row => {
                const cells = row.querySelectorAll('td');
                const rowData = [];
                for (let i = 0; i < cells.length - 1; i++) { // Exclude sparkline column
                    rowData.push(cells[i].textContent.trim());
                }
                rows.push(rowData);
            });

            const csvContent = rows.map(row => row.join(',')).join('\\n');
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.setAttribute('hidden', '');
            a.setAttribute('href', url);
            a.setAttribute('download', `azure-cost-report-${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error exporting CSV:', error);
            alert('Failed to export CSV');
        }
    }

    function formatCurrency(amount) {
        return new Intl.NumberFormat('en-IN', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    }

    function generateSparkline() {
        let html = '';
        for (let i = 0; i < 10; i++) {
            const height = Math.floor(Math.random() * 20) + 5;
            html += `<div style="height: ${height}px;"></div>`;
        }
        return html;
    }

    function showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'fixed top-4 right-4 bg-red-600 text-white p-4 rounded-lg shadow-lg z-50';
        errorDiv.innerHTML = `
            <div class="flex items-center">
                <i class="fas fa-exclamation-circle mr-2"></i>
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" class="ml-4 text-white hover:text-gray-200">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 5000);
    }

    // Enhanced dropdown styling function
    function enhanceDropdownStyling() {
        const dropdowns = document.querySelectorAll('.filter-input');
        
        dropdowns.forEach(dropdown => {
            // Force dark styling
            dropdown.style.backgroundColor = '#334155';
            dropdown.style.color = '#e2e8f0';
            dropdown.style.border = '1px solid #475569';
            
            // Add event listeners for better UX
            dropdown.addEventListener('focus', function() {
                this.style.borderColor = '#3b82f6';
                this.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.1)';
                this.style.backgroundColor = '#1e293b';
            });
            
            dropdown.addEventListener('blur', function() {
                this.style.borderColor = '#475569';
                this.style.boxShadow = 'none';
                this.style.backgroundColor = '#334155';
            });
            
            // For options - this works in some browsers
            const options = dropdown.querySelectorAll('option');
            options.forEach(option => {
                option.style.backgroundColor = '#1e293b';
                option.style.color = '#e2e8f0';
            });
        });
    }

    // Update insights section with AI recommendations
    function updateInsightsSection(insights) {
        const insightsContainer = document.getElementById('insights-list');
        if (!insightsContainer) {
            console.warn('Insights container not found');
            return;
        }

        if (!insights || insights.length === 0) {
            insightsContainer.innerHTML = '<li class="text-gray-400 text-center py-4">No insights available. Configure Azure credentials to get cost insights.</li>';
            return;
        }

        insightsContainer.innerHTML = insights.map(insight => `
            <li class="insight-item p-2 rounded-lg bg-slate-700 border border-slate-600" style="font-size: 0.688rem;">
                <div class="flex justify-between items-start mb-1">
                    <h4 class="font-semibold text-white" style="font-size: 0.75rem;">${insight.title}</h4>
                    <span class="px-2 py-0.5 rounded-full font-medium ${
                        insight.impact === 'high' ? 'bg-red-900 text-red-200' :
                        insight.impact === 'medium' ? 'bg-yellow-900 text-yellow-200' :
                        'bg-green-900 text-green-200'
                    }" style="font-size: 0.625rem;">${insight.impact.toUpperCase()}</span>
                </div>
                <p class="text-gray-300 mb-1" style="font-size: 0.688rem;">${insight.description}</p>
                <p class="text-blue-300 mb-1" style="font-size: 0.688rem;"><strong>Recommendation:</strong> ${insight.recommendation}</p>
                <p class="text-green-300" style="font-size: 0.688rem;"><strong>Potential Savings:</strong> ${insight.savings}</p>
            </li>
        `).join('');
    }

    // Create regional cost chart
    function createRegionalChart(regionalData) {
        const ctx = document.getElementById('region-day-chart');
        if (!ctx) {
            console.warn('Regional chart canvas not found');
            return;
        }

        if (charts.regionDay) {
            charts.regionDay.destroy();
        }

        charts.regionDay = new Chart(ctx, {
            type: 'line',
            data: regionalData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: false
                    },
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: '#e2e8f0',
                            font: {
                                size: 11
                            },
                            padding: 10,
                            boxWidth: 12,
                            boxHeight: 12
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: '#94a3b8',
                            font: {
                                size: 10
                            }
                        },
                        grid: {
                            color: '#475569'
                        }
                    },
                    y: {
                        ticks: {
                            color: '#94a3b8',
                            font: {
                                size: 10
                            },
                            callback: function(value) {
                                return '$' + value.toFixed(2);
                            }
                        },
                        grid: {
                            color: '#475569'
                        }
                    }
                }
            }
        });
    }

    // Call the enhancement function after DOM is ready
    setTimeout(enhanceDropdownStyling, 100);
});
