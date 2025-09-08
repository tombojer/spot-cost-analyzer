let spotData = null;

async function fetchSpotData() {
    try {
        const response = await fetch('https://ngpc-prod-public-data.s3.us-east-2.amazonaws.com/percentiles.json');
        spotData = await response.json();
        populateRegionFilter();
        populateGenerationFilter();
        populateCategoryFilter();
        showBestValueNodes();
    } catch (error) {
        console.error('Error fetching spot data:', error);
        document.getElementById('results').innerHTML = '<div class="error">Error loading data. Please try again.</div>';
    }
}

function populateRegionFilter() {
    const regionSelect = document.getElementById('regionFilter');
    const regions = Object.keys(spotData.regions).sort();
    
    regions.forEach(region => {
        const option = document.createElement('option');
        option.value = region;
        option.textContent = region;
        regionSelect.appendChild(option);
    });
}

function populateGenerationFilter() {
    const generationSelect = document.getElementById('generationFilter');
    const generations = new Set();
    
    for (const regionData of Object.values(spotData.regions)) {
        if (regionData.generation) {
            generations.add(regionData.generation);
        }
    }
    
    const sortedGenerations = Array.from(generations).sort();
    sortedGenerations.forEach(generation => {
        const option = document.createElement('option');
        option.value = generation;
        option.textContent = generation;
        generationSelect.appendChild(option);
    });
}

let selectedCategories = [];

function populateCategoryFilter() {
    const categoryDropdown = document.getElementById('categoryDropdown');
    const categories = new Set();
    
    for (const regionData of Object.values(spotData.regions)) {
        for (const serverData of Object.values(regionData.serverclasses)) {
            if (serverData.category) {
                categories.add(serverData.category);
            }
        }
    }
    
    const sortedCategories = Array.from(categories).sort();
    categoryDropdown.innerHTML = '';
    
    // Pre-select all categories except Bare Metal
    selectedCategories = sortedCategories.filter(cat => !cat.toLowerCase().includes('bare metal'));
    
    sortedCategories.forEach(category => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'multiselect-option';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `category_${category.replace(/\s+/g, '_')}`;
        checkbox.value = category;
        checkbox.checked = selectedCategories.includes(category);
        
        const label = document.createElement('label');
        label.htmlFor = checkbox.id;
        label.textContent = category;
        
        checkbox.addEventListener('change', function() {
            if (this.checked) {
                if (!selectedCategories.includes(category)) {
                    selectedCategories.push(category);
                }
            } else {
                selectedCategories = selectedCategories.filter(cat => cat !== category);
            }
            updateCategoryDisplay();
        });
        
        optionDiv.appendChild(checkbox);
        optionDiv.appendChild(label);
        categoryDropdown.appendChild(optionDiv);
    });
    
    updateCategoryDisplay();
}

function updateCategoryDisplay() {
    const selectedText = document.getElementById('categorySelectedText');
    
    if (selectedCategories.length === 0) {
        selectedText.textContent = 'Select categories...';
    } else if (selectedCategories.length === 1) {
        selectedText.textContent = selectedCategories[0];
    } else {
        selectedText.textContent = `${selectedCategories.length} categories selected`;
    }
}


function toggleCategoryDropdown() {
    const dropdown = document.getElementById('categoryDropdown');
    const arrow = document.querySelector('.multiselect-arrow');
    
    if (dropdown.classList.contains('show')) {
        dropdown.classList.remove('show');
        arrow.classList.remove('open');
    } else {
        dropdown.classList.add('show');
        arrow.classList.add('open');
    }
}

function parseResource(value, unit) {
    if (!value) return 0;
    const numValue = parseFloat(value.toString().replace(/[^\d.]/g, ''));
    if (unit && value.toString().toLowerCase().includes('gb')) {
        return numValue;
    }
    return numValue;
}

function getAllNodes() {
    const nodes = [];
    
    for (const [regionName, regionData] of Object.entries(spotData.regions)) {
        for (const [serverKey, serverData] of Object.entries(regionData.serverclasses)) {
            const cpu = parseResource(serverData.cpu);
            const memory = parseResource(serverData.memory);
            const price = parseFloat(serverData.market_price);
            
            if (cpu > 0 && memory > 0 && price > 0) {
                nodes.push({
                    id: `${regionName}-${serverKey}`,
                    serverKey: serverKey,
                    region: regionName,
                    name: serverData.display_name,
                    category: serverData.category,
                    description: serverData.description,
                    cpu: cpu,
                    memory: memory,
                    price: price,
                    pricePerDay: price * 24,
                    pricePerWeek: price * 24 * 7,
                    pricePerMonth: price * 24 * 30,
                    cpuPerDollarHour: cpu / price,
                    memoryPerDollarHour: memory / price,
                    costPerCpuHour: price / cpu,
                    costPerGbHour: price / memory,
                    generation: regionData.generation,
                    percentiles: {
                        p20: serverData['20_percentile'],
                        p50: serverData['50_percentile'],
                        p80: serverData['80_percentile']
                    }
                });
            }
        }
    }
    
    return nodes;
}

function getSelectedCategories() {
    return selectedCategories;
}

function filterNodesByRequirements(nodes, cpuReq, memoryReq, region, generation, selectedCategories) {
    return nodes.filter(node => {
        const meetsRegion = !region || node.region === region;
        const meetsGeneration = !generation || node.generation === generation;
        const meetsCpu = !cpuReq || node.cpu >= cpuReq;
        const meetsMemory = !memoryReq || node.memory >= memoryReq;
        const meetsCategory = selectedCategories.length === 0 || selectedCategories.includes(node.category);
        return meetsRegion && meetsGeneration && meetsCpu && meetsMemory && meetsCategory;
    });
}

function calculateEfficiency(node, cpuReq, memoryReq) {
    if (!cpuReq && !memoryReq) return 0;
    
    let score = 0;
    let factors = 0;
    
    if (cpuReq > 0) {
        const cpuOverprovision = node.cpu / cpuReq;
        score += 1 / cpuOverprovision;
        factors++;
    }
    
    if (memoryReq > 0) {
        const memoryOverprovision = node.memory / memoryReq;
        score += 1 / memoryOverprovision;
        factors++;
    }
    
    return factors > 0 ? score / factors : 0;
}

function renderNodeCard(node, isRecommended = false) {
    const cardClass = isRecommended ? 'server-card best-value' : 'server-card';
    
    return `
        <div class="${cardClass}" onclick="showPriceHistory('${node.serverKey}', '${node.name}')">
            <div class="server-name">${node.name} <span style="font-size: 12px; color: #666;">(Click for price history)</span></div>
            <div class="server-details">
                <strong>Region:</strong> ${node.region} | 
                <strong>Category:</strong> ${node.category} | 
                <strong>Generation:</strong> ${node.generation}
            </div>
            <div class="server-details">
                <strong>Resources:</strong> ${node.cpu} CPU cores, ${node.memory} GB RAM
            </div>
            <div class="price-info">
                <strong>Pricing:</strong><br>
                • $${node.price.toFixed(4)}/hour<br>
                • $${node.pricePerDay.toFixed(2)}/day<br>
                • $${node.pricePerWeek.toFixed(2)}/week<br>
                • $${node.pricePerMonth.toFixed(2)}/month
                <div class="value-metrics">
                    <div class="metric">
                        <div class="metric-label">Cost per CPU/hour</div>
                        <div class="metric-value">$${node.costPerCpuHour.toFixed(4)}</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">Cost per GB/hour</div>
                        <div class="metric-value">$${node.costPerGbHour.toFixed(4)}</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">Spot P20</div>
                        <div class="metric-value">$${node.percentiles.p20?.toFixed(4) || 'N/A'}</div>
                    </div>
                </div>
            </div>
            ${node.description ? `<div class="server-details"><em>${node.description}</em></div>` : ''}
        </div>
    `;
}

function showBestValueNodes() {
    if (!spotData) return;
    
    const selectedCategories = getSelectedCategories();
    const region = document.getElementById('regionFilter')?.value || null;
    const generation = document.getElementById('generationFilter')?.value || null;
    let nodes = getAllNodes();
    
    if (selectedCategories.length > 0) {
        nodes = nodes.filter(node => selectedCategories.includes(node.category));
    }
    
    if (region) {
        nodes = nodes.filter(node => node.region === region);
    }
    
    if (generation) {
        nodes = nodes.filter(node => node.generation === generation);
    }
    
    const cpuBest = [...nodes].sort((a, b) => a.costPerCpuHour - b.costPerCpuHour).slice(0, 3);
    const memoryBest = [...nodes].sort((a, b) => a.costPerGbHour - b.costPerGbHour).slice(0, 3);
    
    const filterText = [];
    if (region) filterText.push(region);
    if (generation) filterText.push(generation);
    const locationText = filterText.length > 0 ? ` (${filterText.join(', ')})` : '';
    
    let html = `
        <h2>Best Value Nodes${locationText}</h2>
        <h3>🏆 Cheapest CPU Cost per Hour</h3>
        ${cpuBest.map(node => renderNodeCard(node, true)).join('')}
        
        <h3>💾 Cheapest Memory Cost per Hour</h3>
        ${memoryBest.map(node => renderNodeCard(node, true)).join('')}
    `;
    
    document.getElementById('results').innerHTML = html;
}

function analyzeNodes() {
    if (!spotData) {
        document.getElementById('results').innerHTML = '<div class="loading">Loading data...</div>';
        return;
    }
    
    const cpuReq = parseFloat(document.getElementById('cpuRequirement').value) || null;
    const memoryReq = parseFloat(document.getElementById('memoryRequirement').value) || null;
    const region = document.getElementById('regionFilter').value || null;
    const generation = document.getElementById('generationFilter').value || null;
    const selectedCategories = getSelectedCategories();
    
    if (!cpuReq && !memoryReq) {
        showBestValueNodes();
        return;
    }
    
    const allNodes = getAllNodes();
    const suitableNodes = filterNodesByRequirements(allNodes, cpuReq, memoryReq, region, generation, selectedCategories);
    
    if (suitableNodes.length === 0) {
        document.getElementById('results').innerHTML = `
            <h2>No Suitable Nodes Found</h2>
            <p>No nodes found that meet your requirements. Try reducing your requirements or selecting a different region.</p>
        `;
        return;
    }
    
    suitableNodes.forEach(node => {
        node.efficiency = calculateEfficiency(node, cpuReq, memoryReq);
    });
    
    const sortedByCost = [...suitableNodes].sort((a, b) => a.price - b.price);
    const sortedByEfficiency = [...suitableNodes].sort((a, b) => b.efficiency - a.efficiency);
    const sortedByValue = [...suitableNodes].sort((a, b) => {
        const aCost = (cpuReq ? a.costPerCpuHour * cpuReq : 0) + (memoryReq ? a.costPerGbHour * memoryReq : 0);
        const bCost = (cpuReq ? b.costPerCpuHour * cpuReq : 0) + (memoryReq ? b.costPerGbHour * memoryReq : 0);
        return aCost - bCost;
    });
    
    let html = `
        <h2>Node Recommendations</h2>
        <p><strong>Requirements:</strong> ${cpuReq || 'Any'} CPU cores, ${memoryReq || 'Any'} GB memory${region ? ` in ${region}` : ''}${generation ? `, ${generation} generation` : ''}</p>
        
        <h3>💰 Cheapest Options</h3>
        ${sortedByCost.slice(0, 3).map(node => renderNodeCard(node)).join('')}
        
        <h3>⚡ Most Efficient (Least Overprovisioning)</h3>
        ${sortedByEfficiency.slice(0, 3).map(node => renderNodeCard(node)).join('')}
        
        <h3>📈 Best Overall Value</h3>
        ${sortedByValue.slice(0, 3).map(node => renderNodeCard(node, true)).join('')}
    `;
    
    document.getElementById('results').innerHTML = html;
}

let priceChart = null;

async function showPriceHistory(serverKey, nodeName) {
    const modal = document.getElementById('priceHistoryModal');
    const modalTitle = document.getElementById('modalTitle');
    
    modalTitle.textContent = `Price History - ${nodeName}`;
    modal.style.display = 'block';
    
    // Show enhanced loading state
    const chartContainer = document.querySelector('#priceHistoryModal .modal-content div[style*="position: relative"]');
    chartContainer.innerHTML = `
        <div class="loading-container">
            <div class="spinner"></div>
            <div class="loading-text">Loading Price History</div>
            <div class="loading-details">
                Fetching historical pricing data for ${nodeName}<br>
                This may take a few moments for large datasets...<br>
                <small>Processing hundreds of data points</small>
            </div>
        </div>
    `;
    
    try {
        // Use serverKey directly - it should be in the correct format like 'gp.vs1.large-lon'
        const response = await fetch(`https://ngpc-prod-public-data.s3.us-east-2.amazonaws.com/history/${serverKey}`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch price history');
        }
        
        const data = await response.json();
        
        // Store data globally for timeframe filtering
        currentHistoryData = data.history;
        currentNodeName = nodeName;
        
        // Update loading message
        const loadingDetails = document.querySelector('.loading-details');
        if (loadingDetails) {
            loadingDetails.innerHTML = `
                Processing ${data.history.length} price records...<br>
                Optimizing data for chart display...<br>
                <small>Almost ready!</small>
            `;
        }
        
        // Small delay to show the processing message
        setTimeout(() => {
            renderPriceChart(data.history, nodeName, 'all');
            // Setup timeframe controls after chart is rendered
            setTimeout(() => {
                setupTimeframeControls();
            }, 100);
        }, 500);
    } catch (error) {
        console.error('Error fetching price history:', error);
        const chartContainer = document.querySelector('#priceHistoryModal .modal-content div[style*="position: relative"]');
        chartContainer.innerHTML = `
            <div class="loading-container">
                <div class="loading-text" style="color: #d32f2f;">Error Loading Price History</div>
                <div class="loading-details">
                    Failed to fetch pricing data for ${nodeName}<br>
                    This could be due to network issues or unavailable data.<br>
                    <small>Please try again later</small>
                </div>
            </div>
        `;
    }
}

function filterDataByTimeframe(historyData, timeframeDays) {
    if (timeframeDays === 'all') {
        return historyData;
    }
    
    const now = Date.now() / 1000; // Convert to Unix timestamp
    const cutoffTime = now - (timeframeDays * 24 * 60 * 60);
    const filteredData = historyData.filter(item => item.run_at >= cutoffTime);
    
    return filteredData;
}

function renderPriceChart(historyData, nodeName, timeframe = 'all') {
    // Restore chart container
    const chartContainer = document.querySelector('#priceHistoryModal .modal-content div[style*="position: relative"]');
    chartContainer.innerHTML = '<canvas id="priceChart"></canvas>';
    
    const ctx = document.getElementById('priceChart').getContext('2d');
    
    // Destroy existing chart
    if (priceChart) {
        priceChart.destroy();
    }
    
    // Sort data by timestamp (oldest first)
    const sortedData = historyData.sort((a, b) => a.run_at - b.run_at);
    
    // Filter data based on selected timeframe
    const filteredData = filterDataByTimeframe(sortedData, timeframe);
    
    // Use ALL filtered data points - no sampling to preserve important price movements
    const recentData = filteredData;
    
    const labels = recentData.map(item => {
        const date = new Date(item.run_at * 1000);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    });
    
    const prices = recentData.map(item => item.hammer_price);
    
    // Update statistics display
    updatePriceStatistics(recentData, timeframe);
    
    priceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Spot Price ($/hour)',
                data: prices,
                borderColor: '#007cba',
                backgroundColor: 'rgba(0, 124, 186, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 0 // Disable animations for better performance with large datasets
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Time'
                    },
                    ticks: {
                        maxTicksLimit: 15,
                        autoSkip: true
                    }
                },
                y: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Price ($/hour)'
                    },
                    beginAtZero: false
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: `${nodeName} - Complete Price History (${recentData.length} points)`
                },
                legend: {
                    display: true
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            },
            elements: {
                point: {
                    radius: 0, // Hide individual points for better performance with large datasets
                    hoverRadius: 3
                }
            }
        }
    });
}

function calculatePriceStatistics(priceData) {
    if (!priceData || priceData.length === 0) {
        return { average: 0, median: 0, lowest: 0, highest: 0 };
    }
    
    const prices = priceData.map(item => item.hammer_price).sort((a, b) => a - b);
    
    // Calculate statistics
    const lowest = prices[0];
    const highest = prices[prices.length - 1];
    const average = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    
    // Calculate median
    const midpoint = Math.floor(prices.length / 2);
    const median = prices.length % 2 === 0 
        ? (prices[midpoint - 1] + prices[midpoint]) / 2
        : prices[midpoint];
    
    return { average, median, lowest, highest };
}

function updatePriceStatistics(priceData, timeframe) {
    const stats = calculatePriceStatistics(priceData);
    const statisticsContainer = document.getElementById('priceStatistics');
    
    const timeframeLabel = getTimeframeLabel(timeframe).replace(' Price History', '').replace('Complete ', '');
    
    statisticsContainer.innerHTML = `
        <div class="stat-item average">
            <div class="stat-value">$${stats.average.toFixed(4)}</div>
            <div class="stat-label">Average</div>
        </div>
        <div class="stat-item median">
            <div class="stat-value">$${stats.median.toFixed(4)}</div>
            <div class="stat-label">Median</div>
        </div>
        <div class="stat-item lowest">
            <div class="stat-value">$${stats.lowest.toFixed(4)}</div>
            <div class="stat-label">Lowest</div>
        </div>
        <div class="stat-item highest">
            <div class="stat-value">$${stats.highest.toFixed(4)}</div>
            <div class="stat-label">Highest</div>
        </div>
    `;
}

function getTimeframeLabel(timeframe) {
    const labels = {
        'all': 'Complete Price History',
        '365': 'Last 1 Year',
        '180': 'Last 6 Months',
        '90': 'Last 3 Months',
        '30': 'Last 30 Days',
        '7': 'Last 7 Days'
    };
    return labels[timeframe] || 'Price History';
}

function setupTimeframeControls() {
    const timeframeButtons = document.querySelectorAll('.timeframe-btn');
    
    timeframeButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Remove active class from all buttons
            timeframeButtons.forEach(btn => btn.classList.remove('active'));
            
            // Add active class to clicked button
            this.classList.add('active');
            
            // Get selected timeframe
            const selectedTimeframe = this.getAttribute('data-days');
            
            // Re-render chart with new timeframe
            if (currentHistoryData && currentNodeName) {
                renderPriceChart(currentHistoryData, currentNodeName, selectedTimeframe);
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('results').innerHTML = '<div class="loading">Loading spot pricing data...</div>';
    fetchSpotData();
    
    // Modal close functionality
    const modal = document.getElementById('priceHistoryModal');
    const closeBtn = document.querySelector('.close');
    
    closeBtn.onclick = function() {
        modal.style.display = 'none';
        if (priceChart) {
            priceChart.destroy();
            priceChart = null;
        }
    }
    
    // Category dropdown functionality
    const categoryDisplay = document.getElementById('categoryDisplay');
    categoryDisplay.onclick = toggleCategoryDropdown;
    
    // Close dropdown when clicking outside
    window.onclick = function(event) {
        if (event.target === modal) {
            modal.style.display = 'none';
            if (priceChart) {
                priceChart.destroy();
                priceChart = null;
            }
        }
        
        // Close category dropdown if clicking outside
        if (!event.target.closest('.multiselect-container')) {
            const dropdown = document.getElementById('categoryDropdown');
            const arrow = document.querySelector('.multiselect-arrow');
            dropdown.classList.remove('show');
            arrow.classList.remove('open');
        }
    }
});