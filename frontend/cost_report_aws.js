let costByServiceChart, costTrendChart, costByRegionChart;

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'index.html';
    }

    const logoutBtn = document.getElementById('logoutBtn');
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('token');
        window.location.href = 'index.html';
    });

    const timePeriodSelector = document.getElementById('time-period');
    timePeriodSelector.addEventListener('change', () => {
        fetchAllData(timePeriodSelector.value);
    });

    fetchAllData(timePeriodSelector.value);
});

async function fetchAllData(period) {
    const token = localStorage.getItem('token');
    const creds = JSON.parse(localStorage.getItem("aws_credentials"));
    if (!creds) {
        showError("AWS credentials not configured. Please set them in the Cloud Integration page.");
        return;
    }

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };

    const body = JSON.stringify({
        period: period,
        aws_access_key_id: creds.accessKeyId,
        aws_secret_access_key: creds.secretAccessKey,
        aws_default_region: creds.region
    });

    try {
const [summary, byService, byRegion, history] = await Promise.all([
    fetch('/api/aws/cost/summary', { method: 'POST', headers, body }).then(res => res.json()),
    fetch('/api/aws/cost/by-service', { method: 'POST', headers, body }).then(res => res.json()),
    fetch('/api/aws/cost/by-region', { method: 'POST', headers, body }).then(res => res.json()),
    fetch('/api/aws/cost/history', { method: 'POST', headers, body }).then(res => res.json())
]);

const timePeriodSelector = document.getElementById('time-period');
const selectedOption = timePeriodSelector.options[timePeriodSelector.selectedIndex].text;
document.getElementById('total-cost-label').textContent = `Total Cost (${selectedOption})`;
document.getElementById('total-cost').textContent = `$${summary.totalCost.toFixed(2)}`;
document.getElementById('forecast').textContent = `$${summary.forecast.toFixed(2)}`;

renderCostByServiceChart(byService.results);
renderCostByRegionChart(byRegion.results);
renderCostTrendChart(history.results);

    } catch (error) {
        showError('Error fetching cost data. Please check your AWS credentials and try again.');
    }
}

function renderCostByServiceChart(data) {
    const ctx = document.getElementById('costByServiceChart').getContext('2d');
    const { labels, dataset } = processCostDataForPieChart(data);

    if (costByServiceChart) {
        costByServiceChart.destroy();
    }

    costByServiceChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [dataset]
        }
    });
}

function renderCostByRegionChart(data) {
    const ctx = document.getElementById('costByRegionChart').getContext('2d');
    const { labels, dataset } = processCostDataForPieChart(data);

    if (costByRegionChart) {
        costByRegionChart.destroy();
    }

    costByRegionChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [dataset]
        }
    });
}

function renderCostTrendChart(data) {
    const ctx = document.getElementById('costTrendChart').getContext('2d');
    const { labels, datasets } = processCostDataForLineChart(data);

    if (costTrendChart) {
        costTrendChart.destroy();
    }

    costTrendChart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: { scales: { y: { beginAtZero: true } } }
    });
}

function processCostDataForLineChart(data) {
    const labels = [...new Set(data.map(item => item.TimePeriod.Start))].sort();
    const services = {};

    data.forEach(item => {
        item.Groups.forEach(group => {
            const serviceName = group.Keys[0];
            if (!services[serviceName]) {
                services[serviceName] = {
                    label: serviceName,
                    data: new Array(labels.length).fill(0),
                    borderColor: getRandomColor(),
                    fill: false
                };
            }
            const index = labels.indexOf(item.TimePeriod.Start);
            services[serviceName].data[index] += parseFloat(group.Metrics.UnblendedCost.Amount);
        });
    });

    return { labels, datasets: Object.values(services) };
}

function processCostDataForPieChart(data) {
    const serviceCosts = {};

    data.forEach(item => {
        item.Groups.forEach(group => {
            const serviceName = group.Keys[0];
            if (!serviceCosts[serviceName]) {
                serviceCosts[serviceName] = 0;
            }
            serviceCosts[serviceName] += parseFloat(group.Metrics.UnblendedCost.Amount);
        });
    });

    const labels = Object.keys(serviceCosts);
    const dataset = {
        data: Object.values(serviceCosts),
        backgroundColor: labels.map(() => getRandomColor())
    };

    return { labels, dataset };
}

function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

function showError(message) {
    // Create or update error notification
    let errorDiv = document.getElementById('error-notification');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.id = 'error-notification';
        errorDiv.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #f56565; color: white; padding: 15px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); z-index: 1000; max-width: 400px;';
        document.body.appendChild(errorDiv);
    }
    errorDiv.textContent = message;
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        if (errorDiv && errorDiv.parentNode) {
            errorDiv.parentNode.removeChild(errorDiv);
        }
    }, 5000);
}
