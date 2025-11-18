document.addEventListener('DOMContentLoaded', function() {
    const syntheticBox = document.getElementById('synthetic-box');
    const totalUrlsEl = document.getElementById('total-urls');
    const outagesEl = document.getElementById('outages');

    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'index.html';
    }

    if (syntheticBox) {
        syntheticBox.addEventListener('click', () => window.location.href = 'synthetic.html');
    }

    async function fetchDashboardSummary() {
        try {
            const response = await fetch('/api/monitors', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const monitors = await response.json();
                
                // SYNTHETIC MONITORING SCOPE: ONLY HTTP/API MONITORS
                // Filter out AWS CloudWatch monitors - they belong in Cloud Monitoring section
                const syntheticMonitors = monitors.filter(monitor => {
                    const isAwsMonitor = monitor.monitorType === 'aws' || (monitor.url && monitor.url.includes('aws://'));
                    return !isAwsMonitor; // Only count synthetic (HTTP/API) monitors
                });
                
                const totalMonitors = syntheticMonitors.length;
                const outages = syntheticMonitors.filter(m => {
                    const lastResult = m.historyRecords && m.historyRecords.length > 0 ? m.historyRecords[0] : null;
                    return lastResult && lastResult.status.toLowerCase() === 'fail';
                }).length;

                if (totalUrlsEl) {
                    totalUrlsEl.textContent = totalMonitors;
                }
                if (outagesEl) {
                    outagesEl.textContent = outages;
                }

                const outagesCircle = document.querySelector('.stat-circle.outage');
                if (outages > 0) {
                    if (outagesCircle) {
                        outagesCircle.classList.add('unhealthy');
                    }
                } else {
                    if (outagesCircle) {
                        outagesCircle.classList.remove('unhealthy');
                    }
                }
            } else {
                if (response.status === 401 || response.status === 403) {
                    // Token is invalid or expired, redirect to login
                    localStorage.removeItem('token');
                    window.location.href = 'index.html';
                } else {
                    console.error('Failed to fetch dashboard summary');
                }
            }
        } catch (error) {
            console.error('An error occurred while fetching dashboard summary:', error);
        }
    }

    fetchDashboardSummary();
    setInterval(fetchDashboardSummary, 15000);
    
    // Azure Cost Overview functionality
    const azureCostBox = document.getElementById('azure-cost-box');
    if (azureCostBox) {
        azureCostBox.addEventListener('click', () => window.location.href = 'cost_report_azure.html');
    }

    async function fetchAzureCostSummary() {
        try {
            console.log('🚀 Starting Azure cost data fetch for dashboard...');
            
            // First check if Azure is configured
            const statusResponse = await fetch('/api/azure/credentials/status', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!statusResponse.ok) {
                console.warn('⚠️ Azure credentials not configured - showing zero data');
                updateAzureCostCard([]);
                return;
            }

            // Get subscriptions list for detailed breakdown
            const subscriptionsResponse = await fetch('/api/azure/subscriptions', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            console.log(`📋 Subscriptions API response: ${subscriptionsResponse.status}`);

            if (subscriptionsResponse.ok) {
                const subscriptionsData = await subscriptionsResponse.json();
                console.log(`📊 Found ${subscriptionsData.length} Azure subscriptions:`, subscriptionsData.map(sub => sub.displayName || sub.subscriptionId));
                
                // Fetch 7-day cost data for each subscription
                const subscriptionCosts = await fetchSubscriptionCosts(subscriptionsData);
                
                console.log(`💰 Final dashboard data - ${subscriptionCosts.length} subscriptions with costs`);
                updateAzureCostCard(subscriptionCosts);
            } else {
                const errorText = await subscriptionsResponse.text();
                console.warn(`❌ Azure subscription API failed (${subscriptionsResponse.status}):`, errorText);
                console.warn('📋 Showing zero data instead');
                updateAzureCostCard([]);
            }
        } catch (error) {
            console.error('❌ Error fetching Azure cost data:', error);
            console.warn('📋 Showing zero data due to error');
            updateAzureCostCard([]);
        }
    }

    async function fetchSubscriptionCosts(subscriptions) {
        const subscriptionCosts = [];
        
        console.log(`🔍 Fetching costs for ${subscriptions.length} Azure subscriptions...`);
        
        // Fetch ALL subscriptions, not just 5
        for (const sub of subscriptions) {
            try {
                console.log(`📊 Fetching cost for: ${sub.displayName || sub.subscriptionId}`);
                
                const response = await fetch('/api/azure/cost/all-data', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        timePeriod: 'week',
                        subscription: sub.subscriptionId,
                        resourceGroup: ''
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    const costData = {
                        id: sub.subscriptionId,
                        name: sub.displayName || sub.subscriptionId,
                        totalCost: data.summary?.mtdSpend || 0,
                        dailyCosts: generateDailyCosts(data.summary?.mtdSpend || 0),
                        change: data.summary?.mtdChange || 0
                    };
                    
                    subscriptionCosts.push(costData);
                    console.log(`✅ Cost data for ${costData.name}: $${costData.totalCost}`);
                } else {
                    console.warn(`❌ Failed to fetch cost for ${sub.displayName}: ${response.status}`);
                }
            } catch (error) {
                console.warn(`❌ Error fetching cost for subscription ${sub.subscriptionId}:`, error);
            }
        }

        console.log(`📈 Total subscriptions with cost data: ${subscriptionCosts.length}`);
        
        // Return empty array if no real data (don't use sample data)
        return subscriptionCosts;
    }

    function generateDailyCosts(totalCost) {
        const dailyCosts = [];
        const baseDaily = totalCost / 7;
        
        for (let i = 0; i < 7; i++) {
            // Add some variation to make it realistic
            const variation = (Math.random() - 0.5) * 0.4; // ±20% variation
            dailyCosts.push(Math.max(0, baseDaily * (1 + variation)));
        }
        
        return dailyCosts;
    }

    function updateAzureCostCard(subscriptionCosts = []) {
        // Calculate total cost from all subscriptions
        const totalCost = subscriptionCosts.reduce((sum, sub) => sum + sub.totalCost, 0);
        
        console.log(`📊 Dashboard Update: ${subscriptionCosts.length} subscriptions, Total: $${totalCost.toLocaleString()}`);
        
        // Update total cost circle
        const totalCostEl = document.getElementById('total-cost-amount');
        const totalCostCircle = document.getElementById('total-cost-circle');
        
        if (totalCostEl) {
            if (subscriptionCosts.length === 0) {
                // Show $0 when no data
                totalCostEl.textContent = '$0';
            } else if (totalCost >= 100000) {
                totalCostEl.textContent = `$${Math.round(totalCost / 100000)}L`;
            } else if (totalCost >= 1000) {
                totalCostEl.textContent = `$${Math.round(totalCost / 1000)}K`;
            } else {
                totalCostEl.textContent = `$${Math.round(totalCost)}`;
            }
        }

        // Create detailed subscription breakdown for tooltip
        let subscriptionDetails = '';
        if (subscriptionCosts.length > 0) {
            subscriptionDetails = subscriptionCosts.map(sub => 
                `• ${sub.name}: $${Math.round(sub.totalCost)}`
            ).join('\n');
        } else {
            subscriptionDetails = 'No Azure subscriptions configured';
        }

        // Add tooltip with exact amount and subscription breakdown
        if (totalCostCircle) {
            if (subscriptionCosts.length === 0) {
                totalCostCircle.setAttribute('data-tooltip', 'Azure credentials not configured\nConfigure in Cloud Integration to view cost data');
            } else {
                totalCostCircle.setAttribute('data-tooltip', `Total Azure Cost: $${Math.round(totalCost)} (Last 7 Days)\n\nSubscription Breakdown:\n${subscriptionDetails}`);
            }
        }

        // Calculate and update budget usage
        const budget = 350000; // Sample budget - could be fetched from API
        const budgetUsagePercent = budget > 0 ? Math.round((totalCost / budget) * 100) : 0;
        
        const budgetUsageEl = document.getElementById('budget-usage');
        const budgetCircle = document.getElementById('budget-circle');
        
        if (budgetUsageEl) {
            budgetUsageEl.textContent = `${budgetUsagePercent}%`;
        }

        // Create budget breakdown with subscription details
        let budgetBreakdown = '';
        if (subscriptionCosts.length > 0) {
            budgetBreakdown = subscriptionCosts.map(sub => {
                const subBudgetPercent = Math.round((sub.totalCost / budget) * 100);
                return `• ${sub.name}: $${sub.totalCost.toLocaleString()} (${subBudgetPercent}%)`;
            }).join('\n');
        } else {
            budgetBreakdown = 'No subscription data available';
        }

        // Add warning animation if over budget
        if (budgetCircle) {
            if (budgetUsagePercent > 100) {
                budgetCircle.classList.add('over-budget');
            } else {
                budgetCircle.classList.remove('over-budget');
            }
            
            // Add tooltip with budget details and subscription breakdown
            if (subscriptionCosts.length === 0) {
                budgetCircle.setAttribute('data-tooltip', 'Budget usage: 0%\nConfigure Azure credentials to track budget');
            } else {
                budgetCircle.setAttribute('data-tooltip', `Budget Usage: $${totalCost.toLocaleString()} / $${budget.toLocaleString()} (${budgetUsagePercent}%)\n\nSubscription Budget Usage:\n${budgetBreakdown}`);
            }
        }

        console.log(`Azure Dashboard: Total Cost: $${totalCost.toLocaleString()}, Budget Usage: ${budgetUsagePercent}%`);
    }

    // Sample data function removed - dashboard now shows zero data when credentials not configured
    // This matches the behavior of AWS cost reporting

    // Load Azure cost data
    fetchAzureCostSummary();
    setInterval(fetchAzureCostSummary, 30000); // Refresh every 30 seconds

    // Add Cloud Monitoring toggle functionality
    const cloudMonitoringToggle = document.getElementById('cloud-monitoring-toggle');
    const cloudMonitoringSubmenu = document.getElementById('cloud-monitoring-submenu');
    
    if (cloudMonitoringToggle && cloudMonitoringSubmenu) {
        cloudMonitoringToggle.addEventListener('click', () => {
            const isExpanded = cloudMonitoringSubmenu.classList.contains('expanded');
            if (isExpanded) {
                cloudMonitoringSubmenu.classList.remove('expanded');
            } else {
                cloudMonitoringSubmenu.classList.add('expanded');
            }
        });
    }
});
