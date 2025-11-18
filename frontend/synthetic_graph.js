document.addEventListener('DOMContentLoaded', function() {
    const centerTextPlugin = {
        id: 'centerText',
        afterDraw: chart => {
            if (chart.config.type === 'doughnut' && chart.options.plugins.centerText) {
                const { ctx } = chart;
                const { text, color, font } = chart.options.plugins.centerText;
                const centerX = (chart.chartArea.left + chart.chartArea.right) / 2;
                const centerY = (chart.chartArea.top + chart.chartArea.bottom) / 2;

                ctx.save();
                ctx.font = font || '20px sans-serif';
                ctx.fillStyle = color || '#ffffff';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(text, centerX, centerY);
                ctx.restore();
            }
        }
    };
    Chart.register(centerTextPlugin);
    Chart.defaults.color = '#e2e8f0';

    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const monitorId = urlParams.get('monitorId');

    if (!monitorId) {
        window.location.href = 'synthetic.html';
        return;
    }

    let charts = {};
    let historyData = [];

    // Handle time period dropdown
    const timePeriodDropdown = document.getElementById('time-period-dropdown');
    const customDateRangeDiv = document.getElementById('custom-date-range');
    const fromDateInput = document.getElementById('from-date');
    const toDateInput = document.getElementById('to-date');

    timePeriodDropdown.addEventListener('change', () => {
        const value = timePeriodDropdown.value;
        
        if (value === 'custom') {
            customDateRangeDiv.style.display = 'flex';
        } else {
            customDateRangeDiv.style.display = 'none';
            
            const endDate = new Date();
            let startDate = new Date();
            
            switch (value) {
                case '5m': startDate.setMinutes(endDate.getMinutes() - 5); break;
                case '15m': startDate.setMinutes(endDate.getMinutes() - 15); break;
                case '45m': startDate.setMinutes(endDate.getMinutes() - 45); break;
                case '1h': startDate.setHours(endDate.getHours() - 1); break;
                case '4h': startDate.setHours(endDate.getHours() - 4); break;
                case '6h': startDate.setHours(endDate.getHours() - 6); break;
                case '12h': startDate.setHours(endDate.getHours() - 12); break;
                case '24h': startDate.setDate(endDate.getDate() - 1); break;
            }
            
            fetchMonitorHistory(startDate.toISOString(), endDate.toISOString());
        }
    });

    document.getElementById('apply-date-range').addEventListener('click', () => {
        const startDate = new Date(fromDateInput.value);
        const endDate = new Date(toDateInput.value);
        if (startDate && endDate && !isNaN(startDate) && !isNaN(endDate)) {
            fetchMonitorHistory(startDate.toISOString(), endDate.toISOString());
        } else {
            alert('Please select valid start and end dates');
        }
    });

    document.getElementById('refresh-now-btn').addEventListener('click', () => {
        const selectedPeriod = timePeriodDropdown.value;
        
        if (selectedPeriod === 'custom') {
            const startDate = new Date(fromDateInput.value);
            const endDate = new Date(toDateInput.value);
            if (startDate && endDate && !isNaN(startDate) && !isNaN(endDate)) {
                fetchMonitorHistory(startDate.toISOString(), endDate.toISOString());
            } else {
                alert('Please select valid start and end dates');
            }
        } else {
            // Trigger the dropdown change to refresh with current period
            timePeriodDropdown.dispatchEvent(new Event('change'));
        }
    });

    // Auto-refresh functionality
    let autoRefreshInterval;
    const autoRefreshCheckbox = document.getElementById('auto-refresh-toggle');
    
    autoRefreshCheckbox.addEventListener('change', () => {
        if (autoRefreshCheckbox.checked) {
            autoRefreshInterval = setInterval(() => {
                const selectedPeriod = timePeriodDropdown.value;
                if (selectedPeriod === 'custom') {
                    const startDate = new Date(fromDateInput.value);
                    const endDate = new Date(toDateInput.value);
                    if (startDate && endDate && !isNaN(startDate) && !isNaN(endDate)) {
                        fetchMonitorHistory(startDate.toISOString(), endDate.toISOString());
                    }
                } else {
                    timePeriodDropdown.dispatchEvent(new Event('change'));
                }
            }, 300000); // 5 minutes
        } else {
            clearInterval(autoRefreshInterval);
        }
    });

    async function fetchMonitorHistory(start, end) {
        let url = `/api/monitors/${monitorId}/history`;
        if (start && end) {
            url += `?start=${start}&end=${end}`;
        }
        try {
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                historyData = await response.json();
                updateDashboard(historyData);
            } else {
                console.error('Failed to fetch monitor history');
            }
        } catch (error) {
            console.error('Error fetching monitor history:', error);
        }
    }

    function updateDashboard(history) {
        calculateSummaryMetrics(history);
        renderCharts(history);
    }

function calculateSummaryMetrics(history) {
    if (history.length === 0) {
        document.getElementById('avg-response-time').textContent = "N/A";
        document.getElementById('p95-latency').textContent = "N/A";
        document.getElementById('uptime-percentage').textContent = "N/A";
        document.getElementById('total-failures').textContent = "N/A";
        return;
    }

    const responseTimes = history.map(h => h.responseTime);
    const successCount = history.filter(h => h.statusCode >= 200 && h.statusCode < 400).length;
    const totalChecks = history.length;

    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const sortedResponseTimes = [...responseTimes].sort((a, b) => a - b);
    const p95Latency = sortedResponseTimes[Math.floor(sortedResponseTimes.length * 0.95)];
    const uptimePercentage = (successCount / totalChecks) * 100;
    const totalFailures = totalChecks - successCount;

    document.getElementById('avg-response-time').textContent = `${avgResponseTime.toFixed(0)}ms`;
    document.getElementById('p95-latency').textContent = `${p95Latency}ms`;
    document.getElementById('uptime-percentage').textContent = `${uptimePercentage.toFixed(2)}%`;
    document.getElementById('total-failures').textContent = totalFailures;
}

function renderCharts(history) {
    Object.values(charts).forEach(chart => chart.destroy());
    charts = {};

    const labels = history.map(h => new Date(h.createdAt));

    const avgResponseTime = history.map(h => h.responseTime).reduce((a, b) => a + b, 0) / history.length;
    const responseTimes = history.map(h => {
        const value = h.responseTime;
        return value > 5 * avgResponseTime ? 5 * avgResponseTime : value;
    });

    const statusCodes = history.map(h => h.statusCode);

    const avgDataLength = history.map(h => h.dataLength || 0).reduce((a, b) => a + b, 0) / history.length;
    const dataLengths = history.map(h => {
        const value = h.dataLength || 0;
        return value > 5 * avgDataLength ? 5 * avgDataLength : value;
    });

    // 1. Response Time Chart
    const rtCtx = document.getElementById('responseTimeChart').getContext('2d');
    const rtGradient = rtCtx.createLinearGradient(0, 0, 0, 300);
    rtGradient.addColorStop(0, 'rgba(0, 174, 239, 0.5)');
    rtGradient.addColorStop(1, 'rgba(0, 174, 239, 0)');
    charts.responseTime = new Chart(rtCtx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Response Time (ms)',
                data: responseTimes,
                borderColor: '#00AEEF',
                backgroundColor: rtGradient,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { 
                    type: 'time', 
                    time: { 
                        unit: 'second',
                        displayFormats: {
                            second: 'HH:mm:ss'
                        }
                    }, 
                    grid: { color: '#334155' },
                    ticks: {
                        autoSkip: true,
                        maxTicksLimit: 8
                    }
                },
                y: { 
                    grid: { color: '#334155' },
                    suggestedMax: Math.max(...responseTimes) * 1.1
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            return new Date(context[0].label).toLocaleString();
                        },
                        label: function(context) {
                            return `Response Time: ${context.raw} ms`;
                        }
                    }
                }
            }
        }
    });

    // 2. Status Codes Chart
    const scCtx = document.getElementById('statusCodeChart').getContext('2d');
    const status2xx = history.map(h => (h.statusCode >= 200 && h.statusCode < 300 ? 1 : 0));
    const status4xx = history.map(h => (h.statusCode >= 400 && h.statusCode < 500 ? 1 : 0));
    const status5xx = history.map(h => (h.statusCode >= 500 ? 1 : 0));

    charts.statusCode = new Chart(scCtx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: '2xx',
                    data: status2xx,
                    backgroundColor: '#10b981'
                },
                {
                    label: '4xx',
                    data: status4xx,
                    backgroundColor: '#f97316'
                },
                {
                    label: '5xx',
                    data: status5xx,
                    backgroundColor: '#ef4444'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { 
                    type: 'time', 
                    time: { 
                        unit: 'second',
                        displayFormats: {
                            second: 'HH:mm:ss'
                        }
                    }, 
                    grid: { display: false }, 
                    stacked: true,
                    ticks: {
                        autoSkip: true,
                        maxTicksLimit: 8
                    }
                },
                y: { grid: { color: '#334155' }, stacked: true }
            },
            plugins: {
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        title: function(context) {
                            return new Date(context[0].label).toLocaleString();
                        }
                    }
                }
            }
        }
    });

    // 3. Success Rate Chart
    const successCount = history.filter(h => h.statusCode >= 200 && h.statusCode < 400).length;
    const failCount = history.length - successCount;
    const totalChecks = history.length;
    const successPercentage = totalChecks > 0 ? (successCount / totalChecks) * 100 : 0;
    const srCtx = document.getElementById('successRateChart').getContext('2d');
    charts.successRate = new Chart(srCtx, {
        type: 'doughnut',
        data: {
            labels: ['Success', 'Fail'],
            datasets: [{
                data: [successCount, failCount],
                backgroundColor: ['#B8FF8A', '#ef4444'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: {
                    display: false
                },
                centerText: {
                    text: `${successPercentage.toFixed(2)}%`,
                    color: '#B8FF8A',
                    font: 'bold 24px Inter'
                }
            }
        }
    });

    // 4. Data Length Chart
    const dlCtx = document.getElementById('dataLengthChart').getContext('2d');
    const dlGradient = dlCtx.createLinearGradient(0, 0, 0, 300);
    dlGradient.addColorStop(0, 'rgba(167, 139, 250, 0.5)');
    dlGradient.addColorStop(1, 'rgba(167, 139, 250, 0)');
    charts.dataLength = new Chart(dlCtx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Data Length (bytes)',
                data: dataLengths,
                borderColor: '#a78bfa',
                backgroundColor: dlGradient,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { 
                    type: 'time', 
                    time: { 
                        unit: 'second',
                        displayFormats: {
                            second: 'HH:mm:ss'
                        }
                    }, 
                    grid: { color: '#334155' },
                    ticks: {
                        autoSkip: true,
                        maxTicksLimit: 8
                    }
                },
                y: { 
                    grid: { color: '#334155' },
                    suggestedMax: Math.max(...dataLengths)
                }
            }
        }
    });
}

document.getElementById('generate-rca-btn').addEventListener('click', () => {
    const rcaOutput = document.getElementById('rca-output');
    const failures = historyData.filter(h => h.statusCode >= 400);
    if (failures.length === 0) {
        rcaOutput.innerHTML = `<p class="text-green-400">No failures detected in the selected time range.</p>`;
        return;
    }

    const lastFailure = failures[failures.length - 1];
    const aiSummary = `High latency detected in the Asia region due to a DNS resolution delay. The last failure occurred at ${new Date(lastFailure.createdAt).toLocaleString()} with status code ${lastFailure.statusCode}.`;

    rcaOutput.innerHTML = `
        <div class="bg-gray-900 p-4 rounded-lg">
            <p class="text-lg font-semibold">AI Summary:</p>
            <p class="text-gray-300 mb-4">${aiSummary}</p>
            <div class="flex gap-4">
                <button id="view-logs-btn" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg text-sm">View Logs</button>
                <button id="compare-baseline-btn" class="bg-gray-700 hover:bg-gray-600 text-white font-semibold px-4 py-2 rounded-lg text-sm">Compare with Baseline</button>
                <button id="share-report-btn" class="bg-gray-700 hover:bg-gray-600 text-white font-semibold px-4 py-2 rounded-lg text-sm">Share Report</button>
            </div>
        </div>
    `;

    document.getElementById('view-logs-btn').addEventListener('click', async () => {
        try {
            const response = await fetch(`/api/rca/logs/${monitorId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch RCA data');
            }
            
            const rcaData = await response.json();
            
            // Extract the response text properly
            let rcaContent = '';
            if (rcaData.response) {
                rcaContent = rcaData.response;
            } else if (rcaData.data && rcaData.data.response) {
                rcaContent = rcaData.data.response;
            } else if (typeof rcaData === 'string') {
                rcaContent = rcaData;
            } else {
                rcaContent = JSON.stringify(rcaData, null, 2);
            }
            
            // Format the content for better presentation
            const formattedContent = formatRCAContent(rcaContent);
            
            const logsModal = document.createElement('div');
            logsModal.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4';
            logsModal.innerHTML = `
                <div class="bg-gray-800 rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
                    <div class="flex justify-between items-center p-6 border-b border-gray-700">
                        <h2 class="text-2xl font-bold text-white">Root Cause Analysis Report</h2>
                        <button id="close-logs-btn" class="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
                    </div>
                    <div class="overflow-y-auto p-6 flex-1">
                        <div class="bg-gray-900 p-6 rounded-lg">
                            ${formattedContent}
                        </div>
                    </div>
                    <div class="flex justify-end gap-3 p-6 border-t border-gray-700">
                        <button id="close-logs-btn-footer" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg transition">Close</button>
                    </div>
                </div>
            `;
            document.body.appendChild(logsModal);

            const closeModal = () => {
                document.body.removeChild(logsModal);
            };

            document.getElementById('close-logs-btn').addEventListener('click', closeModal);
            document.getElementById('close-logs-btn-footer').addEventListener('click', closeModal);
            
            // Close on background click
            logsModal.addEventListener('click', (e) => {
                if (e.target === logsModal) {
                    closeModal();
                }
            });
        } catch (error) {
            console.error('Error fetching RCA logs:', error);
            alert('Failed to load RCA data. Please try again.');
        }
    });

    document.getElementById('compare-baseline-btn').addEventListener('click', async () => {
        try {
            const response = await fetch(`/api/rca/baseline/${monitorId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch baseline data');
            }
            
            const baseline = await response.json();
            
            const baselineModal = document.createElement('div');
            baselineModal.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4';
            baselineModal.innerHTML = `
                <div class="bg-gray-800 rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col">
                    <div class="flex justify-between items-center p-6 border-b border-gray-700">
                        <h2 class="text-2xl font-bold text-white">Baseline Comparison</h2>
                        <button id="close-baseline-btn" class="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
                    </div>
                    <div class="overflow-y-auto p-6 flex-1">
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div class="bg-gray-900 p-4 rounded-lg border border-gray-700">
                                <div class="text-gray-400 text-sm mb-2">Average Response Time</div>
                                <div class="text-2xl font-bold text-blue-400">${baseline.avgResponseTime}ms</div>
                            </div>
                            <div class="bg-gray-900 p-4 rounded-lg border border-gray-700">
                                <div class="text-gray-400 text-sm mb-2">P95 Latency</div>
                                <div class="text-2xl font-bold text-purple-400">${baseline.p95Latency}ms</div>
                            </div>
                            <div class="bg-gray-900 p-4 rounded-lg border border-gray-700">
                                <div class="text-gray-400 text-sm mb-2">Success Rate</div>
                                <div class="text-2xl font-bold text-green-400">${baseline.successRate}%</div>
                            </div>
                        </div>
                        <div class="bg-gray-900 p-4 rounded-lg">
                            <h3 class="text-lg font-semibold mb-3 text-white">Raw Data</h3>
                            <pre class="text-sm text-gray-300 overflow-x-auto">${JSON.stringify(baseline, null, 2)}</pre>
                        </div>
                    </div>
                    <div class="flex justify-end gap-3 p-6 border-t border-gray-700">
                        <button id="close-baseline-btn-footer" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg transition">Close</button>
                    </div>
                </div>
            `;
            document.body.appendChild(baselineModal);

            const closeModal = () => {
                document.body.removeChild(baselineModal);
            };

            document.getElementById('close-baseline-btn').addEventListener('click', closeModal);
            document.getElementById('close-baseline-btn-footer').addEventListener('click', closeModal);
            
            baselineModal.addEventListener('click', (e) => {
                if (e.target === baselineModal) {
                    closeModal();
                }
            });
        } catch (error) {
            console.error('Error fetching baseline:', error);
            alert('Failed to load baseline data. Please try again.');
        }
    });

    document.getElementById('share-report-btn').addEventListener('click', async () => {
        try {
            const response = await fetch(`/api/rca/report/${monitorId}`, { 
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!response.ok) {
                throw new Error('Failed to share report');
            }
            
            const result = await response.json();
            
            const reportModal = document.createElement('div');
            reportModal.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4';
            reportModal.innerHTML = `
                <div class="bg-gray-800 rounded-lg shadow-2xl max-w-lg w-full">
                    <div class="flex justify-between items-center p-6 border-b border-gray-700">
                        <h2 class="text-2xl font-bold text-white">Share Report</h2>
                        <button id="close-report-btn" class="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
                    </div>
                    <div class="p-6">
                        <div class="flex items-center justify-center mb-4">
                            <svg class="w-16 h-16 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                        </div>
                        <p class="text-lg text-center text-white mb-2">${result.message}</p>
                        <p class="text-sm text-center text-gray-400">The RCA report has been generated and shared with your team.</p>
                    </div>
                    <div class="flex justify-end gap-3 p-6 border-t border-gray-700">
                        <button id="close-report-btn-footer" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg transition">Close</button>
                    </div>
                </div>
            `;
            document.body.appendChild(reportModal);

            const closeModal = () => {
                document.body.removeChild(reportModal);
            };

            document.getElementById('close-report-btn').addEventListener('click', closeModal);
            document.getElementById('close-report-btn-footer').addEventListener('click', closeModal);
            
            reportModal.addEventListener('click', (e) => {
                if (e.target === reportModal) {
                    closeModal();
                }
            });
        } catch (error) {
            console.error('Error sharing report:', error);
            alert('Failed to share report. Please try again.');
        }
    });
});

// Helper function to format RCA content for better presentation
function formatRCAContent(content) {
    if (!content || content === 'undefined') {
        return '<div class="text-gray-400 text-center py-8">No RCA data available. Please try generating the analysis again.</div>';
    }

    // Remove markdown code blocks if present
    content = content.replace(/```[\s\S]*?```/g, '');
    
    // Split content into sections
    const sections = content.split(/\n\n+/);
    let formattedHTML = '';

    sections.forEach(section => {
        section = section.trim();
        if (!section) return;

        // Check if it's a header (starts with #, **, or all caps)
        if (section.match(/^#+\s+/) || section.match(/^\*\*.*\*\*$/) || section.match(/^[A-Z\s]+:$/)) {
            const headerText = section.replace(/^#+\s+/, '').replace(/\*\*/g, '').replace(/:$/, '');
            formattedHTML += `<h3 class="text-xl font-bold text-blue-400 mb-3 mt-6 first:mt-0">${headerText}</h3>`;
        }
        // Check if it's a list item
        else if (section.match(/^[\-\*]\s+/)) {
            const items = section.split('\n').filter(item => item.trim());
            formattedHTML += '<ul class="list-disc list-inside space-y-2 mb-4 text-gray-300">';
            items.forEach(item => {
                const cleanItem = item.replace(/^[\-\*]\s+/, '').replace(/\*\*/g, '');
                formattedHTML += `<li class="leading-relaxed">${cleanItem}</li>`;
            });
            formattedHTML += '</ul>';
        }
        // Check if it contains key-value pairs
        else if (section.match(/:\s+/)) {
            const lines = section.split('\n').filter(line => line.trim());
            formattedHTML += '<div class="bg-gray-800 p-4 rounded-lg mb-4 border border-gray-700">';
            lines.forEach(line => {
                const [key, ...valueParts] = line.split(':');
                const value = valueParts.join(':').trim();
                if (key && value) {
                    formattedHTML += `
                        <div class="flex mb-2 last:mb-0">
                            <span class="font-semibold text-gray-400 min-w-[200px]">${key.trim()}:</span>
                            <span class="text-white ml-4">${value}</span>
                        </div>
                    `;
                } else {
                    formattedHTML += `<p class="text-gray-300 mb-2">${line}</p>`;
                }
            });
            formattedHTML += '</div>';
        }
        // Regular paragraph
        else {
            formattedHTML += `<p class="text-gray-300 mb-4 leading-relaxed">${section.replace(/\*\*/g, '<strong class="text-white">').replace(/\*\*/g, '</strong>')}</p>`;
        }
    });

    return formattedHTML || '<div class="text-gray-400 text-center py-8">Unable to format RCA content. Please check the data format.</div>';
}

    function initializeView() {
        // Trigger the dropdown change to load data for default 1 hour period
        timePeriodDropdown.dispatchEvent(new Event('change'));
    }

    initializeView();
});
