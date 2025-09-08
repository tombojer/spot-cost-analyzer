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

function populateCategoryFilter() {
    const categoryContainer = document.getElementById('categoryFilter');
    const categories = new Set();
    
    for (const regionData of Object.values(spotData.regions)) {
        for (const serverData of Object.values(regionData.serverclasses)) {
            if (serverData.category) {
                categories.add(serverData.category);
            }
        }
    }
    
    const sortedCategories = Array.from(categories).sort();
    categoryContainer.innerHTML = '';
    
    sortedCategories.forEach(category => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'category-item';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `category_${category.replace(/\s+/g, '_')}`;
        checkbox.value = category;
        checkbox.checked = !category.toLowerCase().includes('bare metal');
        
        const label = document.createElement('label');
        label.htmlFor = checkbox.id;
        label.textContent = category;
        
        itemDiv.appendChild(checkbox);
        itemDiv.appendChild(label);
        categoryContainer.appendChild(itemDiv);
    });
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
    const checkboxes = document.querySelectorAll('#categoryFilter input[type="checkbox"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
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
        <div class="${cardClass}">
            <div class="server-name">${node.name}</div>
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

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('results').innerHTML = '<div class="loading">Loading spot pricing data...</div>';
    fetchSpotData();
});