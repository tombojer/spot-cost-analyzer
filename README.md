# Spot Cost Analyzer

A web-based tool for analyzing AWS spot instance pricing and recommendations based on your resource requirements.

## Live Demo

Access the tool at: **<https://tombojer.github.io/spot-cost-analyzer/>**

Data source: **<https://spot.rackspace.com/>**

API Documentation: **<https://rxt.developerhub.io/docs/rackspace-spot-public-api>**

## Features

### Instance Analysis

- **Smart Filtering**: Filter by CPU cores, memory (GB), region, and generation
- **Category Selection**: Multi-select dropdown to choose specific instance categories (General Purpose, Compute Heavy, Memory Heavy, etc.)
- **Best Value Recommendations**: Automatically shows cheapest CPU and memory options

### Price History

- **Interactive Charts**: Click any server card to view detailed price history
- **Timeframe Selection**: View data for All Time, 1 Year, 6 Months, 3 Months, 30 Days, or 7 Days
- **Price Statistics**: See average, median, lowest, and highest prices for selected timeframes
- **Complete Data**: No sampling - preserves all important price movements

### Cost Calculations

- **Multiple Time Periods**: Hourly, daily, weekly, and monthly pricing
- **Value Metrics**: Cost per CPU core and cost per GB RAM
- **Efficiency Analysis**: Shows most cost-effective options for your requirements

### User Experience

- **Responsive Design**: Works on desktop, tablet, and mobile
- **Real-time Data**: Fetches live pricing from Rackspace's spot pricing API
- **Clean Interface**: Modern, intuitive design with consistent spacing

## Technology Stack

- **Frontend**: Vanilla HTML, CSS, JavaScript
- **Charts**: Chart.js for interactive price visualizations
- **Data Source**: Rackspace Spot Pricing API
- **Hosting**: GitHub Pages

## Use Cases

- **Cost Optimization**: Find the most cost-effective instances for your workloads
- **Trend Analysis**: Understand pricing patterns and volatility over time
- **Resource Planning**: Match your CPU/memory requirements with optimal pricing
- **Regional Comparison**: Compare prices across different AWS regions

## How to Use

1. **Set Requirements**: Enter your CPU cores and memory needs (optional)
2. **Apply Filters**: Select region, generation, and instance categories
3. **View Results**: See recommendations sorted by cost, efficiency, and value
4. **Analyze History**: Click any server card to view detailed price trends
5. **Select Timeframe**: Use buttons to focus on specific time periods
6. **Review Statistics**: Check average, median, and price ranges

## Local Development

```bash
# Clone the repository
git clone https://github.com/tombojer/spot-cost-analyzer.git

# Navigate to project directory
cd spot-cost-analyzer

# Open in browser (or use a local server)
open index.html
```

## License

This project is open source and available under the MIT License.

---

