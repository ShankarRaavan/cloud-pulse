document.addEventListener('DOMContentLoaded', function() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/index.html';
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    let monitorId = urlParams.get('monitorId');

    console.log('Initial monitorId from URL:', monitorId);

    // Don't redirect if no monitorId - we'll load regions and instances first
    // if (!monitorId) {
    //     window.location.href = 'aws_infra_monitoring_new.html';
    //     return;
    // }

    // DOM Elements
    const monitorNameHeader = document.getElementById('monitor-name-header');
    const monitorDetailsSubheader = document.getElementById('monitor-details-subheader');
    const backToMonitorsBtn = document.getElementById('back-to-monitors');
    const graphType = document.getElementById('graph-type');
    const alertForm = document.getElementById('alert-form');
    const aiRecommendations = document.getElementById('ai-recommendations');
    const exportCsvBtn = document.getElementById('export-csv');
    const statMin = document.getElementById('stat-min');
    const statMax = document.getElementById('stat-max');
    const statAvg = document.getElementById('stat-avg');
    const statCurrent = document.getElementById('stat-current');
    const resetZoomBtn = document.getElementById('reset-zoom-btn');
    const liveUpdateBtn = document.getElementById('live-update-btn');
    const addMetricSelect = document.getElementById('add-metric-select');
    const alertHistory = document.getElementById('alert-history');
    const timePeriodDropdown = document.getElementById('time-period-dropdown');
    const annotationForm = document.getElementById('annotation-form');
    const dataSourceSelect = document.getElementById('data-source-select');
    const regionSelect = document.getElementById('region-select');
    const instanceSelect = document.getElementById('instance-select');
    const autoRefreshToggle = document.getElementById('auto-refresh-toggle');
    const customDateRange = document.getElementById('custom-date-range');
    const fromDate = document.getElementById('from-date');
    const toDate = document.getElementById('to-date');
    const applyDateRange = document.getElementById('apply-date-range');

    let metricChart = null;
    let chartData = [];
    let liveUpdateInterval = null;
    let autoRefreshInterval = null;

    // Event Listeners
    backToMonitorsBtn.addEventListener('click', () => {
        window.location.href = 'aws_infra_monitoring.html';
    });

    // Time Period Dropdown Handler
    timePeriodDropdown.addEventListener('change', () => {
        if (timePeriodDropdown.value === 'custom') {
            customDateRange.style.display = 'flex';
            // Set default values for custom date range
            const now = new Date();
            const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
            toDate.value = formatDateTimeLocal(now);
            fromDate.value = formatDateTimeLocal(oneHourAgo);
        } else {
            customDateRange.style.display = 'none';
            loadChartData();
        }
    });

    // Apply Custom Date Range
    applyDateRange.addEventListener('click', () => {
        if (fromDate.value && toDate.value) {
            loadChartData();
        } else {
            alert('Please select both start and end dates');
        }
    });

    graphType.addEventListener('change', () => {
        loadChartData();
    });

    alertForm.addEventListener('submit', (e) => {
        e.preventDefault();
        console.log('Alert form submitted');
    });

    exportCsvBtn.addEventListener('click', () => {
        exportToCsv('metric-data.csv', chartData);
    });

    resetZoomBtn.addEventListener('click', () => {
        if (metricChart) {
            metricChart.resetZoom();
        }
    });

    liveUpdateBtn.addEventListener('click', () => {
        loadChartData();
    });

    // Auto-refresh Toggle Handler
    if (autoRefreshToggle) {
        autoRefreshToggle.addEventListener('change', () => {
            if (autoRefreshToggle.checked) {
                autoRefreshInterval = setInterval(() => {
                    loadChartData();
                }, 300000); // 5 minutes
            } else {
                if (autoRefreshInterval) {
                    clearInterval(autoRefreshInterval);
                    autoRefreshInterval = null;
                }
            }
        });
    }

    if (annotationForm) {
        annotationForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const annotationText = document.getElementById('annotation-text').value;
            if (annotationText) {
                addAnnotation(annotationText);
                document.getElementById('annotation-text').value = '';
            }
        });
    }

    if (addMetricSelect) {
        addMetricSelect.addEventListener('change', () => {
            const selectedMetric = addMetricSelect.value;
            if (selectedMetric) {
                addMetricToChart(selectedMetric);
            }
        });
    }

    if (regionSelect) {
        regionSelect.addEventListener('change', () => {
            console.log('Region changed to:', regionSelect.value);
            loadMonitorsByRegion(regionSelect.value);
        });
    } else {
        console.error('regionSelect element not found!');
    }

    if (instanceSelect) {
        instanceSelect.addEventListener('change', () => {
            const selectedValue = instanceSelect.value;
            console.log('Instance changed to:', selectedValue);
            
            // Parse selection: format is either "monitorId" or "monitorId:instanceId"
            let newMonitorId, selectedInstanceId;
            if (selectedValue.includes(':')) {
                [newMonitorId, selectedInstanceId] = selectedValue.split(':');
            } else {
                newMonitorId = selectedValue;
                selectedInstanceId = null; // null means show all instances
            }
            
            if (newMonitorId && (newMonitorId !== monitorId || selectedInstanceId !== window.selectedInstanceId)) {
                monitorId = newMonitorId;
                window.selectedInstanceId = selectedInstanceId;
                const url = new URL(window.location);
                url.searchParams.set('monitorId', newMonitorId);
                if (selectedInstanceId) {
                    url.searchParams.set('instanceId', selectedInstanceId);
                } else {
                    url.searchParams.delete('instanceId');
                }
                window.history.pushState({}, '', url);
                loadChartData();
            } else {
                // If same selection, still reload data
                loadChartData();
            }
        });
    } else {
        console.error('instanceSelect element not found!');
    }

    async function loadChartData() {
        try {
            console.log('Loading chart data for monitor:', monitorId);
            
            if (!monitorId) {
                 monitorNameHeader.textContent = 'No instance selected';
                 monitorDetailsSubheader.textContent = 'Please select a region and instance';
                 console.warn('No monitorId provided');
                 return;
            }
            
            // Show loading state
            const chartLoading = document.getElementById('chart-loading');
            if (chartLoading) {
                chartLoading.style.display = 'flex';
            }
            
            const response = await fetch(`http://localhost:8080/api/monitors/${monitorId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to load monitor data: ${response.status}`);
            }

            const monitor = await response.json();
            console.log('Monitor loaded:', monitor);
            
            // Build resource info for multi-resource monitors
            let resourceInfo = 'N/A';
            if (monitor.resourceIds) {
                try {
                    const resourceIds = JSON.parse(monitor.resourceIds);
                    const resourceNames = monitor.resourceNames ? JSON.parse(monitor.resourceNames) : resourceIds;
                    resourceInfo = `${resourceIds.length} ${monitor.resourceType} instances: ${resourceNames.slice(0, 3).join(', ')}${resourceIds.length > 3 ? '...' : ''}`;
                } catch (e) {
                    resourceInfo = monitor.resourceId || 'N/A';
                }
            } else {
                resourceInfo = monitor.resourceId || 'N/A';
            }
            
            monitorNameHeader.textContent = monitor.name || 'Monitor';
            monitorDetailsSubheader.textContent = `Metric: ${monitor.metricName || 'N/A'} | Resources: ${resourceInfo}`;
            
            const timeRange = timePeriodDropdown.value;
            // Use the new timeseries endpoint for multi-resource monitors
            let url = `http://localhost:8080/api/monitors/${monitor.id}/timeseries?`;
            
            if (timeRange === 'custom') {
                // Use custom date range
                if (fromDate.value && toDate.value) {
                    const startTime = new Date(fromDate.value).toISOString();
                    const endTime = new Date(toDate.value).toISOString();
                    url += `startTime=${startTime}&endTime=${endTime}`;
                } else {
                    console.error('Custom date range selected but dates not provided');
                    if (chartLoading) chartLoading.style.display = 'none';
                    return;
                }
            } else if (timeRange) {
                url += `range=${timeRange}`;
            } else {
                 url += `range=1h`;
            }

            console.log('Fetching metrics from:', url);
            const metricsResponse = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!metricsResponse.ok) {
                throw new Error(`Failed to load metric data: ${metricsResponse.status}`);
            }

            const metricsData = await metricsResponse.json();
            console.log('Metrics data received:', metricsData);
            
            // Hide loading state
            if (chartLoading) {
                chartLoading.style.display = 'none';
            }
            
            // Update last updated timestamp
            const lastUpdatedEl = document.getElementById('last-updated');
            if (lastUpdatedEl) {
                lastUpdatedEl.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
            }
            
            renderChart(monitor, metricsData);
            loadAvailableMetrics(monitor);
            loadAlertHistory(monitor);

        } catch (error) {
            console.error('Error loading chart data:', error);
            monitorNameHeader.textContent = 'Error Loading Monitor';
            monitorDetailsSubheader.textContent = error.message;
            
            // Hide loading state on error
            const chartLoading = document.getElementById('chart-loading');
            if (chartLoading) {
                chartLoading.style.display = 'none';
            }
        }
    }

    function renderChart(monitor, data) {
        const ctx = document.getElementById('metric-chart');
        if (!ctx) return;

        if (metricChart) {
            metricChart.destroy();
        }

        // Handle multi-resource timeseries data
        const datasets = [];
        const colors = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];
        
        if (data.series && data.series.length > 0) {
            // Filter series based on selected instance (if any)
            let seriesToDisplay = data.series;
            if (window.selectedInstanceId) {
                seriesToDisplay = data.series.filter(s => s.resourceId === window.selectedInstanceId);
                console.log(`Filtering to show only instance: ${window.selectedInstanceId}`);
            }
            
            // Multi-resource monitor - create dataset for each resource
            seriesToDisplay.forEach((resourceSeries, index) => {
                const timeSeriesData = resourceSeries.data.map(point => ({
                    x: new Date(point.timestamp),
                    y: point.value
                }));
                
                datasets.push({
                    label: `${monitor.metricName} - ${resourceSeries.resourceName || resourceSeries.resourceId}`,
                    data: timeSeriesData,
                    borderColor: colors[index % colors.length],
                    backgroundColor: `${colors[index % colors.length]}33`,
                    borderWidth: 2,
                    fill: graphType.value === 'area',
                    tension: 0.3
                });
            });
            
            // Use aggregate data for stats if available
            if (data.aggregates) {
                chartData = data.aggregates.data.map(point => ({
                    x: new Date(point.timestamp),
                    y: point.avg
                }));
                updateStats(chartData);
            } else if (datasets.length > 0) {
                chartData = datasets[0].data;
                updateStats(chartData);
            }
        } else {
            // No data available
            console.warn('No series data available');
            chartData = [];
        }

        metricChart = new Chart(ctx, {
            type: graphType.value,
            data: {
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#ffffff'
                        },
                        onClick: (e, legendItem, legend) => {
                            const index = legendItem.datasetIndex;
                            const ci = legend.chart;
                            const meta = ci.getDatasetMeta(index);
                            meta.hidden = meta.hidden === null ? !ci.data.datasets[index].hidden : null;
                            ci.update();
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                    },
                    zoom: {
                        pan: {
                            enabled: true,
                            mode: 'x'
                        },
                        zoom: {
                            wheel: {
                                enabled: true,
                            },
                            pinch: {
                                enabled: true
                            },
                            mode: 'x',
                        }
                    },
                    annotation: {
                        annotations: {
                            thresholdLine: {
                                type: 'line',
                                yMin: monitor.thresholdValue,
                                yMax: monitor.thresholdValue,
                                borderColor: 'rgb(255, 99, 132)',
                                borderWidth: 2,
                                label: {
                                    content: 'Threshold',
                                    enabled: true,
                                    position: 'end'
                                }
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'hour',
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
    }

    function loadAiRecommendations() {
        aiRecommendations.innerHTML = `
            <ul class="list-disc list-inside space-y-2">
                <li>Consider setting a threshold alert for CPU utilization above 80% to prevent performance degradation.</li>
                <li>Enable anomaly detection to automatically identify unusual patterns in your metrics.</li>
            </ul>
        `;
    }

    function updateStats(data) {
        if (data.length === 0) return;
        const values = data.map(d => d.y);
        statMin.textContent = Math.min(...values).toFixed(2);
        statMax.textContent = Math.max(...values).toFixed(2);
        statAvg.textContent = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2);
        statCurrent.textContent = values[values.length - 1].toFixed(2);
    }

    function exportToCsv(filename, rows) {
        const processRow = (row) => row.map(val => {
            let finalVal = val === null ? '' : val.toString();
            if (val instanceof Date) {
                finalVal = val.toLocaleString();
            }
            let result = finalVal.replace(/"/g, '""');
            if (result.search(/("|,|\n)/g) >= 0)
                result = '"' + result + '"';
            return result;
        }).join(',');

        let csvFile = 'timestamp,value\n';
        rows.forEach(row => {
            csvFile += processRow([row.x, row.y]) + '\n';
        });

        const blob = new Blob([csvFile], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function toggleLiveUpdate() {
        if (liveUpdateInterval) {
            clearInterval(liveUpdateInterval);
            liveUpdateInterval = null;
            liveUpdateBtn.innerHTML = '<i class="fas fa-play-circle mr-2"></i> Live';
            liveUpdateBtn.classList.remove('bg-green-500');
            liveUpdateBtn.classList.add('bg-red-500');
        } else {
            liveUpdateInterval = setInterval(loadChartData, 5000);
            liveUpdateBtn.innerHTML = '<i class="fas fa-pause-circle mr-2"></i> Stop';
            liveUpdateBtn.classList.remove('bg-red-500');
            liveUpdateBtn.classList.add('bg-green-500');
        }
    }

    function addAnnotation(text) {
        const annotation = {
            type: 'line',
            scaleID: 'x',
            value: new Date(),
            borderColor: 'rgb(255, 99, 132)',
            borderWidth: 2,
            label: {
                content: text,
                enabled: true,
                position: 'top'
            }
        };
        metricChart.options.plugins.annotation.annotations['annotation' + Date.now()] = annotation;
        metricChart.update();
    }

    async function loadAvailableMetrics(monitor) {
        try {
            const response = await fetch(`http://localhost:8080/api/aws/resources/${monitor.resourceType}/metrics`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                addMetricSelect.innerHTML = '<option value="">Add another metric</option>' +
                    data.metrics.map(metric => `<option value="${metric.name}">${metric.name}</option>`).join('');
            }
        } catch (error) {
            console.error('Error loading available metrics:', error);
        }
    }

    async function addMetricToChart(metricName) {
        const newMetricData = chartData.map(d => ({ x: d.x, y: d.y * (Math.random() + 0.5) }));
        metricChart.data.datasets.push({
            label: metricName,
            data: newMetricData,
            borderColor: `rgb(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)})`,
            backgroundColor: 'rgba(0,0,0,0)',
            borderWidth: 2,
            fill: false,
            tension: 0.3
        });
        metricChart.update();
    }

    function loadAlertHistory(monitor) {
        alertHistory.innerHTML = `
            <ul class="list-disc list-inside space-y-2">
                <li><span class="font-semibold text-red-400">[FIRING]</span> High CPU Utilization at ${new Date().toLocaleString()}</li>
                <li><span class="font-semibold text-green-400">[RESOLVED]</span> High CPU Utilization at ${new Date(Date.now() - 3600 * 1000).toLocaleString()}</li>
            </ul>
        `;
    }

    async function loadRegions() {
        try {
            console.log('=== loadRegions started ===');
            
            // Fetch AWS monitors to extract regions dynamically
            const monitorsResponse = await fetch(`http://localhost:8080/api/monitors?type=aws`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (monitorsResponse.ok) {
                const allMonitors = await monitorsResponse.json();
                
                if (allMonitors && allMonitors.length > 0) {
                    // Extract unique regions from monitors
                    const regionsSet = new Set();
                    allMonitors.forEach(monitor => {
                        // Handle "Default" region as us-east-1
                        const monitorRegion = (monitor.region && monitor.region !== 'Default') 
                            ? monitor.region 
                            : 'us-east-1';
                        regionsSet.add(monitorRegion);
                    });
                    
                    const regions = Array.from(regionsSet).sort();
                    regionSelect.innerHTML = regions.map(r => `<option value="${r}">${r}</option>`).join('');
                    console.log('✅ Dynamic regions loaded from monitors:', regions);
                    
                    // Select first region
                    if (regions.length > 0) {
                        regionSelect.value = regions[0];
                        await loadMonitorsByRegion(regions[0]);
                    }
                    return;
                }
            }
            
            // Fallback to default regions
            console.warn('No monitors found, using default regions');
            const regions = ['us-east-1', 'us-west-2', 'eu-west-1'];
            regionSelect.innerHTML = regions.map(r => `<option value="${r}">${r}</option>`).join('');
            await loadMonitorsByRegion('us-east-1');
            
        } catch (error) {
            console.error('ERROR in loadRegions:', error);
            const regions = ['us-east-1', 'us-west-2', 'eu-west-1'];
            regionSelect.innerHTML = regions.map(r => `<option value="${r}">${r}</option>`).join('');
            instanceSelect.innerHTML = '<option value="">Error loading data</option>';
        }
    }

    async function loadMonitorsByRegion(region) {
        try {
            console.log('=== loadMonitorsByRegion started ===');
            console.log('Region parameter:', region);
            instanceSelect.innerHTML = '<option value="">Loading monitors...</option>';
            
            // Fetch AWS monitors only
            const response = await fetch(`http://localhost:8080/api/monitors?type=aws`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            console.log('loadMonitorsByRegion response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const allMonitors = await response.json();
            console.log('loadMonitorsByRegion: Total AWS monitors:', allMonitors.length);
            
            if (!allMonitors || allMonitors.length === 0) {
                instanceSelect.innerHTML = '<option value="">No monitors found - Create a monitor first</option>';
                console.warn('No AWS monitors found in the system');
                return;
            }
            
            // Filter by region and monitorType=aws
            // Handle 'Default' region as us-east-1
            const filteredMonitors = allMonitors.filter(m => {
                const monitorRegion = (m.region && m.region !== 'Default') ? m.region : 'us-east-1';
                return monitorRegion === region && m.monitorType === 'aws';
            });
            
            console.log('Filtered monitors for region ' + region + ':', filteredMonitors.length);
            console.log('All monitor regions:', allMonitors.map(m => ({ name: m.name, region: m.region })));
            
            if (filteredMonitors.length > 0) {
                // Build dropdown with individual instance options
                const instanceOptions = [];
                
                // If URL has monitorId, only show options for that specific monitor
                const urlMonitorIdForFilter = monitorId; // Use the global monitorId from URL
                
                // Filter to only the selected monitor if monitorId is set
                let monitorsToShow = urlMonitorIdForFilter 
                    ? filteredMonitors.filter(m => m.id === urlMonitorIdForFilter)
                    : filteredMonitors;
                
                if (monitorsToShow.length === 0 && urlMonitorIdForFilter) {
                    // If the URL monitor is not in this region, show all monitors
                    monitorsToShow = filteredMonitors;
                }
                
                console.log(`Showing ${monitorsToShow.length} monitor(s) in dropdown`);
                
                monitorsToShow.forEach(monitor => {
                    if (monitor.resourceIds) {
                        try {
                            const resourceIds = JSON.parse(monitor.resourceIds);
                            const resourceNames = monitor.resourceNames ? JSON.parse(monitor.resourceNames) : resourceIds;
                            
                            // Create option for "All instances" (multi-line view)
                            if (resourceIds.length > 1) {
                                instanceOptions.push({
                                    value: monitor.id,
                                    label: `${monitor.name} - All ${resourceIds.length} instances`,
                                    monitorId: monitor.id,
                                    isAggregate: true
                                });
                            }
                            
                            // Create separate option for EACH instance
                            resourceIds.forEach((instanceId, index) => {
                                const instanceName = resourceNames[index] || instanceId;
                                instanceOptions.push({
                                    value: `${monitor.id}:${instanceId}`,
                                    label: `${monitor.name} - ${instanceName} (${instanceId})`,
                                    monitorId: monitor.id,
                                    instanceId: instanceId,
                                    isAggregate: false
                                });
                            });
                        } catch (e) {
                            // Fallback for old single-resource monitors
                            instanceOptions.push({
                                value: monitor.id,
                                label: `${monitor.name} (${monitor.resourceId || 'N/A'})`,
                                monitorId: monitor.id,
                                isAggregate: false
                            });
                        }
                    } else {
                        // Old single-resource monitor
                        instanceOptions.push({
                            value: monitor.id,
                            label: `${monitor.name} (${monitor.resourceId || 'N/A'})`,
                            monitorId: monitor.id,
                            isAggregate: false
                        });
                    }
                });
                
                // Build dropdown HTML
                instanceSelect.innerHTML = instanceOptions.map(opt => 
                    `<option value="${opt.value}">${opt.label}</option>`
                ).join('');
                
                // Check URL parameters for monitorId and instanceId
                const urlParams = new URLSearchParams(window.location.search);
                const urlMonitorId = urlParams.get('monitorId');
                const urlInstanceId = urlParams.get('instanceId');
                
                // If URL has both monitorId and instanceId, select specific instance
                if (urlMonitorId && urlInstanceId) {
                    const optionValue = `${urlMonitorId}:${urlInstanceId}`;
                    if (instanceOptions.some(opt => opt.value === optionValue)) {
                        instanceSelect.value = optionValue;
                        monitorId = urlMonitorId;
                        window.selectedInstanceId = urlInstanceId;
                        console.log('✅ Selected specific instance from URL:', urlInstanceId);
                        loadChartData();
                        return;
                    }
                }
                
                // If monitorId in URL matches one in the list, select it (all instances view)
                if (urlMonitorId && filteredMonitors.some(m => m.id === urlMonitorId)) {
                    instanceSelect.value = urlMonitorId;
                    monitorId = urlMonitorId;
                    window.selectedInstanceId = null;
                    console.log('✅ Selected monitor from URL (all instances):', urlMonitorId);
                    loadChartData();
                } else {
                    // Select first option (could be aggregate or single instance)
                    const firstOption = instanceOptions[0];
                    instanceSelect.value = firstOption.value;
                    if (firstOption.value.includes(':')) {
                        [monitorId, window.selectedInstanceId] = firstOption.value.split(':');
                    } else {
                        monitorId = firstOption.value;
                        window.selectedInstanceId = null;
                    }
                    const url = new URL(window.location);
                    url.searchParams.set('monitorId', monitorId);
                    if (window.selectedInstanceId) {
                        url.searchParams.set('instanceId', window.selectedInstanceId);
                    }
                    window.history.pushState({}, '', url);
                    console.log('✅ Auto-selected first option:', firstOption.label);
                    loadChartData();
                }
            } else {
                instanceSelect.innerHTML = '<option value="">No AWS monitors in this region</option>';
                console.log('No monitors found for region:', region);
            }
                
        } catch (error) {
            console.error('Error loading monitors:', error);
            instanceSelect.innerHTML = '<option value="">Error loading monitors</option>';
        }
    }

    // Helper function to format date for datetime-local input
    function formatDateTimeLocal(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    // Initial load
    console.log('Starting initial load...');
    console.log('Initial monitorId:', monitorId);
    
    // Set default loading messages for dropdowns
    if (regionSelect) {
        regionSelect.innerHTML = '<option value="">Loading regions...</option>';
    }
    if (instanceSelect) {
        instanceSelect.innerHTML = '<option value="">Loading instances...</option>';
    }
    
    loadRegions().then(() => {
        console.log('Regions loaded successfully, monitorId is:', monitorId);
    }).catch(error => {
        console.error('Error during region load:', error);
        if (regionSelect) {
            regionSelect.innerHTML = '<option value="">Error loading regions</option>';
        }
    });
    
    loadAiRecommendations();

    // ============================================
    // CLOUDWATCH LOG GROUPS FUNCTIONALITY
    // ============================================

    const logGroupsList = document.getElementById('log-groups-list');
    const logGroupsLoading = document.getElementById('log-groups-loading');
    const logGroupsEmpty = document.getElementById('log-groups-empty');
    const logGroupsCount = document.getElementById('log-groups-count');
    const refreshLogsBtn = document.getElementById('refresh-logs-btn');
    
    // Log Viewer Modal Elements
    const logViewerModal = document.getElementById('log-viewer-modal');
    const logViewerClose = document.getElementById('log-viewer-close');
    const logViewerTitle = document.getElementById('log-viewer-title');
    const logViewerRefresh = document.getElementById('log-viewer-refresh');
    const logViewerDownload = document.getElementById('log-viewer-download');
    const logTimeRange = document.getElementById('log-time-range');
    const logFilterInput = document.getElementById('log-filter-input');
    const logLiveTail = document.getElementById('log-live-tail');
    const applyLogFilter = document.getElementById('apply-log-filter');
    const logStreamSelect = document.getElementById('log-stream-select');
    const logEventsLoading = document.getElementById('log-events-loading');
    const logEventsList = document.getElementById('log-events-list');
    const logPagination = document.getElementById('log-pagination');
    const logPrevPage = document.getElementById('log-prev-page');
    const logNextPage = document.getElementById('log-next-page');
    const logPageInfo = document.getElementById('log-page-info');
    const logStreamsSelector = document.getElementById('log-streams-selector');

    let currentLogGroup = null;
    let currentLogToken = null;
    let logTailInterval = null;

    // Load log groups for current monitor
    async function loadLogGroups() {
        if (!monitorId) {
            console.log('No monitorId, skipping log groups load');
            showLogGroupsEmpty();
            return;
        }

        try {
            const response = await fetch(`http://localhost:8080/api/monitors/${monitorId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                console.warn('Failed to fetch monitor details');
                showLogGroupsEmpty();
                return;
            }

            const monitor = await response.json();
            
            // Extract resource type and IDs
            let resourceType = monitor.resourceType || 'lambda';
            let resourceIds = '';
            
            // Handle different resource ID formats
            if (monitor.resourceIds) {
                try {
                    const parsed = JSON.parse(monitor.resourceIds);
                    resourceIds = Array.isArray(parsed) ? parsed.join(',') : parsed;
                } catch {
                    resourceIds = monitor.resourceIds;
                }
            } else if (monitor.resourceId) {
                resourceIds = monitor.resourceId;
            }

            if (!resourceIds) {
                console.log('No resource IDs found for monitor');
                showLogGroupsEmpty();
                return;
            }

            showLogGroupsLoading();

            const logsResponse = await fetch(
                `http://localhost:8080/api/aws/log-groups/${resourceType}/${encodeURIComponent(resourceIds)}`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );

            if (!logsResponse.ok) {
                const errorText = await logsResponse.text();
                console.warn('Failed to fetch log groups:', errorText);
                showLogGroupsEmpty();
                return;
            }

            const data = await logsResponse.json();
            displayLogGroups(data.logGroups || []);

        } catch (error) {
            console.error('Error loading log groups:', error);
            showLogGroupsEmpty();
        }
    }

    function showLogGroupsLoading() {
        if (logGroupsLoading) logGroupsLoading.style.display = 'flex';
        if (logGroupsList) logGroupsList.style.display = 'none';
        if (logGroupsEmpty) logGroupsEmpty.style.display = 'none';
    }

    function showLogGroupsEmpty() {
        if (logGroupsLoading) logGroupsLoading.style.display = 'none';
        if (logGroupsList) logGroupsList.style.display = 'none';
        if (logGroupsEmpty) logGroupsEmpty.style.display = 'block';
        if (logGroupsCount) logGroupsCount.textContent = '0 groups';
    }

    function displayLogGroups(logGroups) {
        if (logGroupsLoading) logGroupsLoading.style.display = 'none';
        if (logGroupsEmpty) logGroupsEmpty.style.display = 'none';

        if (!logGroups || logGroups.length === 0) {
            showLogGroupsEmpty();
            return;
        }

        if (logGroupsList) logGroupsList.style.display = 'block';
        if (logGroupsCount) logGroupsCount.textContent = `${logGroups.length} group${logGroups.length !== 1 ? 's' : ''}`;

        logGroupsList.innerHTML = logGroups.map(lg => `
            <div class="log-group-item" data-log-group="${lg.name}">
                <div class="log-group-header">
                    <div class="log-group-name">
                        <i class="fas fa-folder-open mr-2"></i>${lg.name}
                    </div>
                    <div class="log-group-badge">${lg.pattern || 'AWS Logs'}</div>
                </div>
                <div class="log-group-info">
                    <div class="log-group-info-item">
                        <i class="fas fa-database"></i>
                        <span>${formatBytes(lg.storedBytes)}</span>
                    </div>
                    ${lg.retentionInDays ? `
                    <div class="log-group-info-item">
                        <i class="fas fa-clock"></i>
                        <span>${lg.retentionInDays} days retention</span>
                    </div>
                    ` : ''}
                    <div class="log-group-info-item">
                        <i class="fas fa-calendar"></i>
                        <span>${formatLogDate(lg.creationTime)}</span>
                    </div>
                </div>
                <div class="log-group-actions">
                    <button class="log-action-btn view-logs-btn" data-log-group="${lg.name}">
                        <i class="fas fa-eye"></i>View Logs
                    </button>
                    <button class="log-action-btn view-streams-btn" data-log-group="${lg.name}">
                        <i class="fas fa-stream"></i>View Streams
                    </button>
                </div>
            </div>
        `).join('');

        // Attach event listeners
        document.querySelectorAll('.view-logs-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const logGroupName = btn.getAttribute('data-log-group');
                openLogViewer(logGroupName);
            });
        });

        document.querySelectorAll('.view-streams-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const logGroupName = btn.getAttribute('data-log-group');
                openLogViewer(logGroupName, true);
            });
        });
    }

    function formatBytes(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    function formatLogDate(timestamp) {
        if (!timestamp) return 'Unknown';
        const date = new Date(timestamp);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    // Open Log Viewer Modal
    async function openLogViewer(logGroupName, showStreams = false) {
        currentLogGroup = logGroupName;
        currentLogToken = null;

        if (logViewerModal) logViewerModal.style.display = 'flex';
        if (logViewerTitle) logViewerTitle.textContent = `Logs: ${logGroupName}`;

        if (showStreams) {
            await loadLogStreams(logGroupName);
            if (logStreamsSelector) logStreamsSelector.style.display = 'block';
        } else {
            if (logStreamsSelector) logStreamsSelector.style.display = 'none';
            await loadLogEvents(logGroupName);
        }
    }

    // Close Log Viewer
    if (logViewerClose) {
        logViewerClose.addEventListener('click', () => {
            if (logViewerModal) logViewerModal.style.display = 'none';
            stopLiveTail();
        });
    }

    // Load log streams
    async function loadLogStreams(logGroupName) {
        try {
            const response = await fetch(
                `http://localhost:8080/api/aws/log-groups/${encodeURIComponent(logGroupName)}/streams`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );

            if (!response.ok) throw new Error('Failed to fetch log streams');

            const data = await response.json();
            
            if (logStreamSelect) {
                logStreamSelect.innerHTML = '<option value="">All Streams</option>' +
                    (data.streams || []).map(stream => 
                        `<option value="${stream.name}">${stream.name}</option>`
                    ).join('');
            }

        } catch (error) {
            console.error('Error loading log streams:', error);
        }
    }

    // Load log events
    async function loadLogEvents(logGroupName, streamName = null) {
        if (logEventsLoading) logEventsLoading.style.display = 'flex';
        if (logEventsList) logEventsList.innerHTML = '';

        try {
            const timeRange = parseInt(logTimeRange.value) || 3600000;
            const endTime = Date.now();
            const startTime = endTime - timeRange;
            const filterPattern = logFilterInput.value || '';

            let url = `http://localhost:8080/api/aws/log-groups/${encodeURIComponent(logGroupName)}/events?` +
                `startTime=${startTime}&endTime=${endTime}&limit=100`;

            if (streamName) {
                url += `&streamName=${encodeURIComponent(streamName)}`;
            }
            if (filterPattern) {
                url += `&filterPattern=${encodeURIComponent(filterPattern)}`;
            }
            if (currentLogToken) {
                url += `&nextToken=${encodeURIComponent(currentLogToken)}`;
            }

            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Failed to fetch log events');

            const data = await response.json();
            displayLogEvents(data.events || []);
            
            currentLogToken = data.nextToken || data.nextForwardToken;
            
            if (logPagination) {
                logPagination.style.display = currentLogToken ? 'flex' : 'none';
            }

        } catch (error) {
            console.error('Error loading log events:', error);
            if (logEventsList) {
                logEventsList.innerHTML = `
                    <div style="color: #ef4444; padding: 1rem; text-align: center;">
                        <i class="fas fa-exclamation-triangle"></i>
                        Error loading logs: ${error.message}
                    </div>
                `;
            }
        } finally {
            if (logEventsLoading) logEventsLoading.style.display = 'none';
        }
    }

    function displayLogEvents(events) {
        if (!events || events.length === 0) {
            if (logEventsList) {
                logEventsList.innerHTML = `
                    <div style="color: #9ca3af; padding: 2rem; text-align: center;">
                        <i class="fas fa-inbox" style="font-size: 2rem; margin-bottom: 0.5rem;"></i>
                        <p>No log events found for the selected time range</p>
                    </div>
                `;
            }
            return;
        }

        if (logEventsList) {
            logEventsList.innerHTML = events.map((event, index) => {
                const date = new Date(event.timestamp);
                const timeStr = date.toLocaleTimeString('en-US', { 
                    hour12: false, 
                    hour: '2-digit', 
                    minute: '2-digit', 
                    second: '2-digit',
                    fractionalSecondDigits: 3
                });
                const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                // Detect log level from message
                let level = 'INFO';
                let levelColor = '#3b82f6';
                let levelBg = 'rgba(59, 130, 246, 0.1)';
                
                const msg = event.message.toUpperCase();
                if (msg.includes('ERROR') || msg.includes('FATAL') || msg.includes('EXCEPTION')) {
                    level = 'ERROR';
                    levelColor = '#ef4444';
                    levelBg = 'rgba(239, 68, 68, 0.1)';
                } else if (msg.includes('WARN')) {
                    level = 'WARN';
                    levelColor = '#f59e0b';
                    levelBg = 'rgba(245, 158, 11, 0.1)';
                } else if (msg.includes('DEBUG')) {
                    level = 'DEBUG';
                    levelColor = '#8b5cf6';
                    levelBg = 'rgba(139, 92, 246, 0.1)';
                } else if (msg.includes('START') || msg.includes('INIT')) {
                    level = 'START';
                    levelColor = '#10b981';
                    levelBg = 'rgba(16, 185, 129, 0.1)';
                } else if (msg.includes('END') || msg.includes('REPORT')) {
                    level = 'END';
                    levelColor = '#06b6d4';
                    levelBg = 'rgba(6, 182, 212, 0.1)';
                }

                // Extract stream name
                const streamName = event.logStreamName ? event.logStreamName.split('/').pop().substring(0, 20) : '';

                // Format message with syntax highlighting
                let formattedMsg = escapeHtml(event.message)
                    .replace(/\b(ERROR|FATAL|EXCEPTION)\b/g, '<span style="color: #ef4444; font-weight: 600;">$1</span>')
                    .replace(/\b(WARN|WARNING)\b/g, '<span style="color: #f59e0b; font-weight: 600;">$1</span>')
                    .replace(/\b(INFO)\b/g, '<span style="color: #3b82f6; font-weight: 600;">$1</span>')
                    .replace(/\b(DEBUG)\b/g, '<span style="color: #8b5cf6; font-weight: 600;">$1</span>')
                    .replace(/\b(START|INIT_START)\b/g, '<span style="color: #10b981; font-weight: 600;">$1</span>')
                    .replace(/\b(END|REPORT)\b/g, '<span style="color: #06b6d4; font-weight: 600;">$1</span>')
                    .replace(/(\d+\.\d+\s*ms|\d+\s*ms)/g, '<span style="color: #a78bfa;">$1</span>')
                    .replace(/(\d+\.\d+\s*MB|\d+\s*MB)/g, '<span style="color: #fbbf24;">$1</span>')
                    .replace(/RequestId:\s*([a-f0-9-]+)/gi, 'RequestId: <span style="color: #60a5fa;">$1</span>')
                    .replace(/Version:\s*(\S+)/gi, 'Version: <span style="color: #34d399;">$1</span>');

                const isExpanded = false;

                return `
                    <div class="log-row" data-index="${index}" style="border-left: 3px solid ${levelColor}; background: ${levelBg};">
                        <div class="log-row-header">
                            <span class="log-timestamp" title="${date.toISOString()}">
                                <span style="color: #6b7280; font-size: 0.7rem;">${dateStr}</span>
                                <span style="color: #9ca3af; font-weight: 600; margin-left: 0.25rem;">${timeStr}</span>
                            </span>
                            <span class="log-level" style="background: ${levelColor}; color: white;">${level}</span>
                            ${streamName ? `<span class="log-stream" title="${event.logStreamName}">${streamName}</span>` : ''}
                            <span class="log-expand-btn" onclick="this.parentElement.parentElement.classList.toggle('expanded')">
                                <i class="fas fa-chevron-down"></i>
                            </span>
                        </div>
                        <div class="log-row-content">
                            <div class="log-message">${formattedMsg}</div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    function escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    // Live Tail
    function startLiveTail() {
        stopLiveTail();
        if (currentLogGroup) {
            loadLogEvents(currentLogGroup, logStreamSelect?.value || null);
            logTailInterval = setInterval(() => {
                loadLogEvents(currentLogGroup, logStreamSelect?.value || null);
            }, 5000);
        }
    }

    function stopLiveTail() {
        if (logTailInterval) {
            clearInterval(logTailInterval);
            logTailInterval = null;
        }
    }

    // Event Listeners for Log Viewer
    if (refreshLogsBtn) {
        refreshLogsBtn.addEventListener('click', () => loadLogGroups());
    }

    if (logViewerRefresh) {
        logViewerRefresh.addEventListener('click', () => {
            if (currentLogGroup) {
                currentLogToken = null;
                loadLogEvents(currentLogGroup, logStreamSelect?.value || null);
            }
        });
    }

    if (applyLogFilter) {
        applyLogFilter.addEventListener('click', () => {
            if (currentLogGroup) {
                currentLogToken = null;
                loadLogEvents(currentLogGroup, logStreamSelect?.value || null);
            }
        });
    }

    if (logLiveTail) {
        logLiveTail.addEventListener('change', (e) => {
            if (e.target.checked) {
                startLiveTail();
            } else {
                stopLiveTail();
            }
        });
    }

    if (logStreamSelect) {
        logStreamSelect.addEventListener('change', () => {
            if (currentLogGroup) {
                currentLogToken = null;
                loadLogEvents(currentLogGroup, logStreamSelect.value || null);
            }
        });
    }

    if (logNextPage) {
        logNextPage.addEventListener('click', () => {
            if (currentLogGroup && currentLogToken) {
                loadLogEvents(currentLogGroup, logStreamSelect?.value || null);
            }
        });
    }

    if (logViewerDownload) {
        logViewerDownload.addEventListener('click', () => {
            const logText = Array.from(document.querySelectorAll('.log-event-entry'))
                .map(entry => entry.textContent.trim())
                .join('\n');
            
            const blob = new Blob([logText], { type: 'text/plain' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${currentLogGroup.replace(/\//g, '_')}_${Date.now()}.log`;
            a.click();
            window.URL.revokeObjectURL(url);
        });
    }

    // Load log groups after metrics load
    setTimeout(() => {
        loadLogGroups();
    }, 1000);
});
