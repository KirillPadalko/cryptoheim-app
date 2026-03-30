import { API } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
});

async function initDashboard() {
    await renderAssetsBlock();
    await renderMarketForecast();

    await renderNewsBlock();
    await renderMarketScan();
    await renderSentiment();
    await renderDominance();
    await renderGlobalMarkets();
}

/**
 * BLOCK 2: News Summary
 */
async function renderNewsBlock() {
    const container = document.getElementById('news-content');
    if (!container) return;

    try {
        const news = await API.getLatestNews();
        if (!news) {
            container.innerHTML = '<p class="text-muted">No news available.</p>';
            return;
        }

        const date = new Date(news.timestamp * 1000).toLocaleString();

        container.innerHTML = `
            <div class="news-meta">
                <span class="news-date">${date}</span>
                <span class="news-model">${news.model_used || 'AI'}</span>
            </div>
            <div class="news-summary-text">
                ${news.summary.replace(/\n\n/g, '<br><br>')}
            </div>
            <div class="news-sources">
                <strong>Sources:</strong> ${news.sources ? news.sources.join(', ') : 'Various'}
            </div>
        `;
    } catch (e) {
        console.error("Error rendering news:", e);
        container.innerHTML = '<p class="error">Failed to load news.</p>';
    }
}

/**
 * AI Market Forecast
 */
async function renderMarketForecast() {
    const container = document.getElementById('forecast-content');
    if (!container) return;

    try {
        const lang = navigator.language.substring(0, 2) || 'en';
        const data = await API.getMarketForecast(lang);
        if (!data || !data.forecast) {
            container.innerHTML = '<p class="text-muted">Forecast unavailable.</p>';
            return;
        }

        const f = data.forecast;
        
        let signalsHtml = '';
        if (f.top_signals && f.top_signals.length > 0) {
            const renderSignalBadge = (signalStr) => {
                const s = String(signalStr).toLowerCase();
                if (s.includes('buy')) return 'change-up';
                if (s.includes('sell')) return 'change-down';
                return 'text-muted';
            };

            const signalCards = f.top_signals.map(s => `
                <div class="signal-card" style="background: rgba(255,255,255,0.02); padding: 1.2rem; border: 1px solid rgba(255,255,255,0.05); border-radius: 0; position: relative;">
                    <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 0.8rem;">
                        <span style="font-family: var(--font-mono); font-weight: bold; font-size: 1.2rem; color: var(--text-main);">${s.symbol}</span>
                        <span class="signal-badge ${renderSignalBadge(s.signal)}" style="padding: 0.2rem 0.6rem; font-size: 0.8rem; text-transform: uppercase; font-family: var(--font-mono); border: 1px solid currentColor;">${s.signal}</span>
                    </div>
                    <p style="font-size: 0.95rem; color: var(--text-muted); line-height: 1.5; margin: 0; font-family: var(--font-mono);">${s.reason}</p>
                </div>
            `).join('');
            
            signalsHtml = `
                <div class="forecast-section" style="margin-top: 2rem;">
                    <h4 style="margin-bottom: 1rem; color: var(--accent-highlight); font-family: var(--font-mono); text-transform: uppercase;">Top Signals</h4>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem;">
                        ${signalCards}
                    </div>
                </div>
            `;
        }

        container.innerHTML = `
            <div class="news-meta" style="margin-bottom: 1.5rem;">
                <span class="news-date">${new Date(data.timestamp).toLocaleString()}</span>
                <span class="news-model" style="margin-left: 1rem; color: var(--accent-highlight); border: 1px solid var(--accent-highlight); padding: 0.2rem 0.5rem; font-family: var(--font-mono); text-transform: uppercase; font-size: 0.8rem;">Model: ${data.model_used}</span>
            </div>
            
            <div class="forecast-grid" style="display: flex; flex-direction: column; gap: 1.5rem;">
                <div class="forecast-section">
                    <h4 style="margin-bottom: 0.8rem; color: var(--accent-highlight); font-family: var(--font-mono); text-transform: uppercase;">Market State</h4>
                    <p style="color: var(--text-main); line-height: 1.7; font-size: 1.05rem;">${f.market_state}</p>
                </div>
                
                <div class="forecast-section" style="border-left: 2px solid var(--accent-highlight); padding-left: 1rem;">
                    <h4 style="margin-bottom: 0.8rem; color: var(--accent-highlight); font-family: var(--font-mono); text-transform: uppercase;">Short-Term Forecast</h4>
                    <p style="color: var(--text-main); line-height: 1.7; font-size: 1.05rem;">${f.forecast}</p>
                </div>
                
                ${signalsHtml}

                <div class="forecast-section" style="margin-top: 1rem; background: rgba(255, 68, 0, 0.05); border-left: 2px solid var(--accent-alert); padding: 1.5rem;">
                    <h4 style="margin-bottom: 0.8rem; color: var(--accent-alert); font-family: var(--font-mono); text-transform: uppercase;">Risks & Warnings</h4>
                    <p style="color: var(--text-main); line-height: 1.6; font-size: 1rem; margin: 0;">${f.risks}</p>
                </div>
            </div>
        `;

    } catch (e) {
        console.error("Error rendering forecast:", e);
        container.innerHTML = '<p class="error">Failed to load market forecast.</p>';
    }
}

/**
 * BLOCK 3: Market Scan
 */
async function renderMarketScan() {
    const container = document.getElementById('scan-content');
    if (!container) return;

    try {
        const scan = await API.getMarketScan();
        if (!scan) {
            container.innerHTML = '<p class="text-muted">Market scan unavailable.</p>';
            return;
        }

        const { breadth, signals, top_movers } = scan;

        // Breadth HTML
        const breadthHtml = `
            <div class="scan-section">
                <h4>Market Breadth (Mood: ${breadth.mood})</h4>
                <div class="breadth-stats">
                    <div class="stat-item">
                        <span class="stat-label">Above SMA 50</span>
                        <span class="stat-value">${(breadth.above_sma_50_percent * 100).toFixed(1)}%</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Above EMA 21</span>
                        <span class="stat-value">${(breadth.above_ema_21_percent * 100).toFixed(1)}%</span>
                    </div>
                </div>
            </div>
        `;

        // Signals HTML
        const renderSignalList = (title, list, colorClass) => {
            if (!list || list.length === 0) return '';
            return `<div class="signal-group">
                <span class="signal-title">${title}:</span>
                <span class="signal-coins ${colorClass}">${list.join(', ')}</span>
            </div>`;
        };

        const signalsHtml = `
            <div class="scan-section">
                <h4>Trading Signals</h4>
                ${renderSignalList('Oversold RSI', signals.oversold_rsi, 'change-up')}
                ${renderSignalList('Overbought RSI', signals.overbought_rsi, 'change-down')}
                ${renderSignalList('Bullish Momentum', signals.bullish_momentum, 'change-up')}
                ${renderSignalList('Volatility Squeeze', signals.volatility_squeeze, 'text-muted')}
            </div>
        `;

        // Top Movers HTML
        const renderMovers = (title, list, isGainer) => {
            if (!list || list.length === 0) return '';
            const items = list.map(m => `
                <div class="mover-item">
                    <span class="mover-symbol">${m.symbol}</span>
                    <span class="mover-change ${isGainer ? 'change-up' : 'change-down'}">${isGainer ? '+' : ''}${m.daily_change_percent.toFixed(2)}%</span>
                </div>
            `).join('');

            return `
                <div class="movers-column">
                    <h5>${title}</h5>
                    ${items}
                </div>
            `;
        };

        const moversHtml = `
            <div class="scan-section">
                <h4>Top Movers</h4>
                <div class="movers-grid">
                    ${renderMovers('Gainers', top_movers.gainers, true)}
                    ${renderMovers('Losers', top_movers.losers, false)}
                </div>
            </div>
        `;

        container.innerHTML = breadthHtml + signalsHtml + moversHtml;

    } catch (e) {
        console.error("Error rendering scan:", e);
        container.innerHTML = '<p class="error">Failed to load market scan.</p>';
    }
}

/**
 * BLOCK 4: Sentiment & Season
 */
async function renderSentiment() {
    const fgContainer = document.getElementById('fear-greed');
    const altContainer = document.getElementById('alt-season');
    if (!fgContainer || !altContainer) return;

    try {
        const [fg, alt] = await Promise.all([
            API.getFearGreedIndex(),
            API.getAltcoinSeasonIndex()
        ]);

        const drawGauge = (value, label, max = 100) => {
            const percent = Math.min(100, Math.max(0, (value / max) * 100));
            let color = '#00E676';
            if (percent < 30) color = '#FF1744';
            else if (percent < 50) color = '#FF9100';
            else if (percent < 70) color = '#FFC400';

            return `
                <div class="gauge-value" style="color: ${color}">${value}</div>
                <div class="gauge-label">${label}</div>
                <div class="gauge-bar-bg">
                    <div class="gauge-bar-fill" style="width: ${percent}%; background: ${color}"></div>
                </div>
            `;
        };

        if (fg) {
            fgContainer.innerHTML = drawGauge(fg.current_value, fg.current_classification);
        }

        if (alt) {
            altContainer.innerHTML = drawGauge(alt.current_value || 0, alt.classification || 'Bitcoin Season');
        }

    } catch (e) {
        console.error("Error rendering sentiment:", e);
    }
}

/**
 * BLOCK 1: 50 Coins with Values & Sparklines
 */
async function renderAssetsBlock() {
    const container = document.getElementById('assets-carousel');
    if (!container) return;

    try {
        // Fetch both assets list and sparklines concurrently
        const [assets, sparklines] = await Promise.all([
            API.getAssets(),
            API.getSparklines()
        ]);

        if (!assets || !assets.length) {
            container.innerHTML = '<p class="error">Failed to load market data.</p>';
            return;
        }

        container.innerHTML = ''; // Clear loading spinner

        // Take top 50
        const top50 = assets.slice(0, 50);

        top50.forEach((asset, index) => {
            const pill = document.createElement('div');
            pill.className = 'asset-pill';

            let priceChange24h = 0;
            const assetSparkline = sparklines && sparklines[asset.symbol];

            if (assetSparkline && assetSparkline.length > 0) {
                const first = assetSparkline[0];
                const last = assetSparkline[assetSparkline.length - 1];
                if (first > 0) {
                    priceChange24h = (last - first) / first;
                }
            }

            const isUp = priceChange24h >= 0;
            const changeClass = isUp ? 'change-up' : 'change-down';
            const changeSign = isUp ? '+' : '';

            // Format price based on value
            const formattedPrice = asset.price > 1
                ? `$${parseFloat(asset.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : `$${parseFloat(asset.price).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 })}`;

            pill.innerHTML = `
                <div class="asset-pill-header">
                    <span class="asset-name">${asset.symbol}</span>
                    <span class="asset-change ${changeClass}">${changeSign}${(priceChange24h * 100).toFixed(2)}%</span>
                </div>
                <div class="asset-price">${formattedPrice}</div>
                <canvas class="sparkline-canvas" id="sparkline-${index}"></canvas>
            `;
            container.appendChild(pill);

            // Draw sparkline if data exists
            if (assetSparkline) {
                drawSparkline(`sparkline-${index}`, assetSparkline, isUp);
            }
        });
    } catch (e) {
        container.innerHTML = '<p class="error">Error rendering market data.</p>';
        console.error(e);
    }
}

/**
 * Utility to draw a smooth sparkline on canvas using Chart.js
 */
function drawSparkline(canvasId, dataPoints, isUp) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    const color = isUp ? '#00E676' : '#FF1744'; // Green or Red

    // Create a smooth mini chart
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: dataPoints.map((_, i) => i),
            datasets: [{
                data: dataPoints,
                borderColor: color,
                borderWidth: 1.5,
                tension: 0.4, // Smooth curve
                pointRadius: 0,
                pointHoverRadius: 0,
                fill: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            scales: {
                x: { display: false },
                y: { display: false, min: Math.min(...dataPoints) * 0.99, max: Math.max(...dataPoints) * 1.01 }
            },
            layout: { padding: 0 },
            animation: false
        }
    });
}

/**
 * BLOCK 5: Dominance Charts
 */
async function renderDominance() {
    const canvas = document.getElementById('dominanceChart');
    if (!canvas) return;

    try {
        const streamgraph = await API.getDominanceStreamgraph();
        if (!streamgraph || !streamgraph.data || streamgraph.data.length === 0) {
            canvas.parentElement.innerHTML = '<p class="text-muted">Dominance data unavailable.</p>';
            return;
        }

        const dataPoints = streamgraph.data.sort((a, b) => a.timestamp - b.timestamp);

        const labels = dataPoints.map(p => {
            const ts = p.timestamp < 10000000000 ? p.timestamp * 1000 : p.timestamp;
            return new Date(ts);
        });

        const btcData = dataPoints.map(p => p.btc_dominance || p.btcDominance);
        const ethData = dataPoints.map(p => p.eth_dominance || p.ethDominance);

        const ctx = canvas.getContext('2d');

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'BTC Dominance',
                        data: btcData,
                        borderColor: '#FF9100',
                        backgroundColor: 'rgba(255, 145, 0, 0.2)',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0
                    },
                    {
                        label: 'ETH Dominance',
                        data: ethData,
                        borderColor: '#627EEA',
                        backgroundColor: 'rgba(98, 126, 234, 0.2)',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { position: 'top', labels: { color: '#E0E0E0', font: { family: 'Outfit' } } }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: { unit: 'day' },
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#666666' }
                    },
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#666666', callback: function (value) { return value + "%"; } }
                    }
                }
            }
        });
    } catch (e) {
        console.error("Error rendering dominance:", e);
    }
}

/**
 * BLOCK 6: Global Markets (VIX, SP500, etc)
 */
async function renderGlobalMarkets() {
    const container = document.getElementById('global-metrics-content');
    if (!container) return;

    try {
        const stats = await API.getMarketStats();
        if (!stats || stats.length === 0) {
            container.innerHTML = '<p class="text-muted">Global markets data unavailable.</p>';
            return;
        }

        for (const stat of stats) {
            const div = document.createElement('div');
            div.className = 'global-stat-item';
            div.innerHTML = `
                <div class="stat-header">
                    <span class="stat-name">${stat.name}</span>
                    <span class="stat-current" id="current-${stat.id}">...</span>
                </div>
                <div class="stat-chart-container" style="height: 60px; width: 100%;">
                    <canvas id="chart-${stat.id}"></canvas>
                </div>
            `;
            container.appendChild(div);

            // Fetch the chart data
            API.getMarketStatChart(stat.id, 30).then(chartDto => {
                if (chartDto && chartDto.data && chartDto.data.length > 0) {
                    const sorted = chartDto.data.sort((a, b) => a.timestamp - b.timestamp);
                    const currentVal = sorted[sorted.length - 1].value;
                    document.getElementById(`current-${stat.id}`).innerText = currentVal.toFixed(2);

                    const values = sorted.map(d => d.value);
                    const isUp = values[values.length - 1] > values[0];
                    drawSparkline(`chart-${stat.id}`, values, isUp);
                }
            });
        }
    } catch (e) {
        console.error("Error rendering global markets:", e);
    }
}
