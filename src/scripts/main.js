import { API } from './api.js';

const REFRESH_INTERVAL_SEC = 300; // 5 minutes
let timeRemaining = REFRESH_INTERVAL_SEC;

document.addEventListener('DOMContentLoaded', () => {
    startDashboard();
});

async function startDashboard() {
    await updateDashboardData();
    startRefreshTimer();
}

async function updateDashboardData() {
    // Parallel fetch for speed
    await Promise.all([
        renderMarketForecast(),
        renderNewsBlock(),
        renderMarketScan(),
        renderBotPosition()
    ]);
}

function startRefreshTimer() {
    const timerText = document.getElementById('refresh-timer');
    const progressBar = document.getElementById('timer-progress-bar');
    
    if (!timerText || !progressBar) return;

    setInterval(() => {
        timeRemaining--;

        if (timeRemaining <= 0) {
            timeRemaining = REFRESH_INTERVAL_SEC;
            updateDashboardData();
        }

        // Update UI
        const minutes = Math.floor(timeRemaining / 60);
        const seconds = timeRemaining % 60;
        timerText.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        const progressPercent = (timeRemaining / REFRESH_INTERVAL_SEC) * 100;
        progressBar.style.width = `${progressPercent}%`;
    }, 1000);
}

/**
 * BLOCK 2: News Summary
 */
let newsTimer = null; // Unused now but kept to avoid undefined errors if referenced elsewhere

async function renderNewsBlock() {
    const container = document.getElementById('news-content');
    if (!container) return;

    try {
        const news = await API.getLatestNews("ru");
        if (!news || !news.summary) {
            container.innerHTML = '<p class="text-muted">No news available.</p>';
            return;
        }

        const date = new Date(news.timestamp * 1000).toLocaleString();
        const paragraphs = news.summary
            .split('\n')
            .map(p => p.trim())
            .filter(p => p.length > 20); // Only keeping meaningful paragraphs

        const paragraphsHtml = paragraphs.map(p => `
            <p style="margin-bottom: 0.75rem; color: var(--text-main); line-height: 1.5; font-size: 0.8rem; font-family: var(--font-mono);">${p}</p>
        `).join('');

        container.innerHTML = `
            <div class="news-scrollable" style="flex: 1; overflow-y: auto; padding-right: 5px;">
                ${paragraphsHtml}
            </div>
            <div class="news-footer" style="padding-top: 0.5rem; margin-top: auto; display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono); border-top: 1px dashed rgba(255,255,255,0.1);">
                <span>${date}</span>
                <span>AI Agent: ${news.model_used || 'GPT'}</span>
            </div>
        `;

        // Hide customized scrollbar
        const scrollable = container.querySelector('.news-scrollable');
        if(scrollable) {
            scrollable.style.cssText += `
                scrollbar-width: thin;
                scrollbar-color: rgba(255,255,255,0.1) transparent;
            `;
        }

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
        const cleanSymbol = (sym) => sym.replace('USDT', '');
        const getIcon = (sym) => `<img src="https://bin.bnbstatic.com/static/assets/logos/${cleanSymbol(sym).toLowerCase()}.png" class="coin-icon" onerror="this.style.display='none'" style="width: 16px; height: 16px; border-radius: 50%;">`;
        
        let signalsHtml = '';
        if (f.top_signals && f.top_signals.length > 0) {
            const renderSignalBadge = (signalStr) => {
                const s = String(signalStr).toLowerCase();
                if (s.includes('buy')) return 'change-up';
                if (s.includes('sell')) return 'change-down';
                return 'text-muted';
            };

            const signalCards = f.top_signals.map(s => `
                <div class="signal-card" style="background: rgba(255,255,255,0.02); padding: 0.75rem; border: 1px solid rgba(255,255,255,0.05); position: relative;">
                    <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                        <span style="display: flex; align-items: center; gap: 0.4rem; font-family: var(--font-mono); font-weight: bold; font-size: 0.9rem; color: var(--text-main);">
                            ${getIcon(s.symbol)} ${cleanSymbol(s.symbol)}
                        </span>
                        <span class="signal-badge ${renderSignalBadge(s.signal)}" style="padding: 0.1rem 0.4rem; font-size: 0.7rem; text-transform: uppercase; font-family: var(--font-mono); border: 1px solid currentColor;">${s.signal}</span>
                    </div>
                    <p style="font-size: 0.75rem; color: var(--text-muted); line-height: 1.4; margin: 0; font-family: var(--font-mono);">${s.reason}</p>
                </div>
            `).join('');
            
            signalsHtml = `
                <div class="forecast-section" style="margin-top: 1rem;">
                    <h4 style="margin-bottom: 0.5rem; color: var(--accent-highlight); font-family: var(--font-mono); text-transform: uppercase; font-size: 0.8rem;">Top Signals</h4>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.5rem;">
                        ${signalCards}
                    </div>
                </div>
            `;
        }

        container.innerHTML = `
            <div class="forecast-grid" style="display: flex; flex-direction: column; gap: 1rem; padding: 0;">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem;">
                    <div class="forecast-section" style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05); padding: 0.75rem;">
                        <h4 style="margin-bottom: 0.5rem; color: var(--accent-highlight); font-family: var(--font-mono); text-transform: uppercase; font-size: 0.8rem;">Market State</h4>
                        <p style="color: var(--text-main); line-height: 1.5; font-size: 0.8rem; margin: 0;">${f.market_state}</p>
                    </div>
                    
                    <div class="forecast-section" style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05); padding: 0.75rem;">
                        <h4 style="margin-bottom: 0.5rem; color: var(--accent-highlight); font-family: var(--font-mono); text-transform: uppercase; font-size: 0.8rem;">Short-Term Forecast</h4>
                        <p style="color: var(--text-main); line-height: 1.5; font-size: 0.8rem; margin: 0;">${f.forecast}</p>
                    </div>
                </div>

                <div class="forecast-section" style="background: rgba(255, 68, 0, 0.05); border-left: 2px solid var(--accent-alert); padding: 0.75rem;">
                    <h4 style="margin-bottom: 0.5rem; color: var(--accent-alert); font-family: var(--font-mono); text-transform: uppercase; font-size: 0.8rem;">Risks & Warnings</h4>
                    <p style="color: var(--text-main); line-height: 1.4; font-size: 0.8rem; margin: 0;">${f.risks}</p>
                </div>
                
                ${signalsHtml}

                <div class="news-footer" style="display: flex; justify-content: flex-end; font-size: 0.7rem; color: var(--text-muted); font-family: var(--font-mono); margin-top: 0.5rem;">
                    <span>AI Agent: ${data.model_used} | ${new Date(data.timestamp).toLocaleString()}</span>
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

        const cleanSymbol = (s) => s.replace('USDT', '');
        const getIcon = (s) => `<img src="https://bin.bnbstatic.com/static/assets/logos/${cleanSymbol(s).toLowerCase()}.png" class="coin-icon" onerror="this.style.display='none'">`;

        // Top Movers HTML (NOW AT TOP)
        const renderMovers = (title, list, isGainer) => {
            if (!list || list.length === 0) return '';
            const items = list.map(m => `
                <div class="mover-item">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        ${getIcon(m.symbol)}
                        <span class="mover-symbol">${cleanSymbol(m.symbol)}</span>
                    </div>
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
            <div class="scan-section movers-section">
                <div class="movers-grid">
                    ${renderMovers('Gainers', top_movers.gainers, true)}
                    ${renderMovers('Losers', top_movers.losers, false)}
                </div>
            </div>
        `;

        // Breadth HTML
        const breadthHtml = `
            <div class="scan-section">
                <div class="breadth-stats">
                    <div class="stat-item">
                        <span class="stat-label">Mood: ${breadth.mood}</span>
                        <span class="stat-value" style="font-size: 1rem;">Above SMA50: ${breadth.above_sma_50_percent.toFixed(0)}%</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">EMA21</span>
                        <span class="stat-value" style="font-size: 1rem;">${breadth.above_ema_21_percent.toFixed(0)}%</span>
                    </div>
                </div>
            </div>
        `;

        // Signals HTML
        const renderSignalList = (title, list, colorClass) => {
            if (!list || list.length === 0) return '';
            return `<div class="signal-group">
                <span class="signal-title" style="font-size: 0.75rem;">${title}:</span>
                <span class="signal-coins ${colorClass}" style="font-size: 0.75rem;">${list.map(cleanSymbol).join(', ')}</span>
            </div>`;
        };

        const signalsHtml = `
            <div class="scan-section" style="margin-bottom: 0;">
                <h4 style="font-size: 0.8rem; border: none; margin-bottom: 0.5rem;">Signals</h4>
                ${renderSignalList('Oversold', signals.oversold_rsi, 'change-up')}
                ${renderSignalList('Bullish', signals.bullish_momentum, 'change-up')}
                ${renderSignalList('Volatility', signals.volatility_squeeze, 'text-muted')}
            </div>
        `;

        container.innerHTML = moversHtml + breadthHtml + signalsHtml;

    } catch (e) {
        console.error("Error rendering scan:", e);
        container.innerHTML = '<p class="error">Failed to load market scan.</p>';
    }
}



/**
 * Chart.js plugin for horizontal lines
 */
const drawHorizontalLinePlugin = {
    id: 'horizontalLines',
    beforeDraw(chart) {
        if (!chart.options.plugins.horizontalLines) return;
        const { ctx, chartArea: { top, bottom, left, right }, scales: { x, y } } = chart;
        const lines = chart.options.plugins.horizontalLines.lines || [];
        ctx.save();
        lines.forEach(line => {
            const yPos = y.getPixelForValue(line.value);
            if (yPos >= top && yPos <= bottom) {
                ctx.beginPath();
                ctx.lineWidth = line.width || 1;
                ctx.strokeStyle = line.color || '#fff';
                ctx.setLineDash(line.dash || [5, 5]);
                ctx.moveTo(left, yPos);
                ctx.lineTo(right, yPos);
                ctx.stroke();

                if (line.text) {
                    ctx.fillStyle = line.textColor || line.color;
                    ctx.font = 'bold 11px monospace';
                    ctx.fillText(line.text, left + 8, yPos - 6);
                }
            }
        });
        ctx.restore();
    }
};

if (window.Chart) {
    Chart.register(drawHorizontalLinePlugin);
}

/**
 * Trading Bot Position
 */
async function renderBotPosition() {
    const container = document.getElementById('position-content');
    if (!container) return;

    try {
        const positions = await API.getBotPositions();
        if (!positions || positions.length === 0) {
            container.innerHTML = `
                <div style="display: flex; align-items: center; width: 100%; color: var(--text-muted); font-family: var(--font-mono);">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 0.5rem; opacity: 0.5;">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <span>No Active Positions</span>
                </div>`;
            return;
        }

        const cleanSymbol = (sym) => sym.replace('USDT', '');

        // Fetch additional data in parallel
        const [stats, klines, sparklinesObj] = await Promise.all([
            API.getBotStats().catch(() => null),
            API.getKlinesSummary(positions[0].symbol).catch(() => null),
            API.getSparklines().catch(() => null) // Ensure sparklines is called correctly
        ]);

        let balanceChangeStr = '';
        if (stats && stats.balance_history && stats.balance_history.length > 0) {
            const first = stats.balance_history[0].equity;
            const last = stats.balance_history[stats.balance_history.length - 1].equity;
            const changePct = ((last - first) / first) * 100;
            const isUp = changePct >= 0;
            balanceChangeStr = `
                <div style="display: flex; align-items: center; gap: 0.5rem; background: rgba(255,255,255,0.05); padding: 0.35rem 0.75rem; border-radius: 6px;">
                    <span style="color: var(--text-muted); font-size: 0.7rem; text-transform: uppercase;">Bot PnL</span>
                    <span class="${isUp ? 'change-up' : 'change-down'}" style="font-weight: bold; font-size: 0.95rem;">${isUp ? '+' : ''}${changePct.toFixed(2)}%</span>
                </div>`;
        }

        const pos = positions[0]; // Display the first active position
        const isLong = pos.side.toLowerCase() === 'buy';
        const sideColor = isLong ? 'var(--accent-highlight)' : 'var(--accent-alert)';
        
        const iconUrl = `https://bin.bnbstatic.com/static/assets/logos/${cleanSymbol(pos.symbol).toLowerCase()}.png`;

        let currentPrice = null;
        if (klines && klines.length > 0) currentPrice = klines[0].price;

        const formatPrice = (p) => {
            if (!p) return '--';
            if (p < 0.01) return p.toFixed(5);
            if (p < 1) return p.toFixed(4);
            return p.toFixed(2);
        };

        container.innerHTML = `
            <div style="display: flex; flex-direction: column; width: 100%; font-family: var(--font-mono); gap: 1.5rem;">
                
                <!-- Headers & Stats Top Row -->
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
                    
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <img src="${iconUrl}" class="coin-icon" onerror="this.style.display='none'" style="width: 36px; height: 36px; border-radius: 50%;">
                        <div style="display: flex; flex-direction: column;">
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <span style="font-weight: 800; font-size: 1.3rem; color: var(--text-main); line-height: 1;">${cleanSymbol(pos.symbol)}</span>
                                <span style="background: ${isLong ? 'rgba(0, 230, 118, 0.1)' : 'rgba(255, 23, 68, 0.1)'}; border: 1px solid ${sideColor}; color: ${sideColor}; padding: 0.1rem 0.5rem; border-radius: 4px; font-size: 0.7rem; font-weight: bold; text-transform: uppercase;">
                                    ${isLong ? 'LONG' : 'SHORT'}
                                </span>
                            </div>
                            <span style="color: var(--text-muted); font-size: 0.75rem; margin-top: 0.2rem; letter-spacing: 0.05em;">Live Trade Active</span>
                        </div>
                        <div style="margin-left: 1rem;">
                            ${balanceChangeStr}
                        </div>
                    </div>

                    <div style="display: flex; gap: 2.5rem; align-items: center;">
                        <div style="display: flex; flex-direction: column; align-items: flex-end;">
                            <span style="color: var(--text-muted); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em;">Size</span>
                            <span style="color: var(--text-main); font-weight: 700; font-size: 1.1rem;">${pos.size.toFixed(2)}</span>
                        </div>
                        <div style="display: flex; flex-direction: column; align-items: flex-end;">
                            <span style="color: rgba(255,255,255,0.5); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em;">Entry Price</span>
                            <span style="color: rgba(255,255,255,0.9); font-weight: 700; font-size: 1.1rem;">$${formatPrice(pos.entry_price)}</span>
                        </div>
                        <div style="display: flex; flex-direction: column; align-items: flex-end;">
                            <span style="color: var(--accent-highlight); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.8;">Take Profit</span>
                            <span style="color: var(--accent-highlight); font-weight: 700; font-size: 1.1rem;">$${formatPrice(pos.tp_price)}</span>
                        </div>
                        <div style="display: flex; flex-direction: column; align-items: flex-end;">
                            <span style="color: var(--accent-alert); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.8;">Stop Loss</span>
                            <span style="color: var(--accent-alert); font-weight: 700; font-size: 1.1rem;">$${formatPrice(pos.sl_price)}</span>
                        </div>
                        <div style="display: flex; flex-direction: column; align-items: flex-end; border-left: 1px solid rgba(255,255,255,0.1); padding-left: 2rem; margin-left: -0.5rem;">
                            <span style="color: #fff; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.7;">Current Price</span>
                            <span style="color: #fff; font-weight: 800; font-size: 1.25rem;">$${formatPrice(currentPrice)}</span>
                        </div>
                    </div>
                </div>

                <!-- Big Chart Row -->
                <div style="height: 140px; width: 100%; position: relative; background: rgba(0,0,0,0.2); border-radius: 8px; border: 1px solid rgba(255,255,255,0.02); padding: 0.5rem; box-sizing: border-box;">
                    <canvas id="active-trade-chart-canvas"></canvas>
                </div>

            </div>
        `;

        // Render Sparkline with Entry/SL/TP lines
        const sparklineData = sparklinesObj && sparklinesObj[pos.symbol] ? sparklinesObj[pos.symbol] : null;
        if (sparklineData && sparklineData.length > 0) {
            const ctx = document.getElementById('active-trade-chart-canvas').getContext('2d');
            const sparkColor = sparklineData[sparklineData.length - 1] >= sparklineData[0] ? '#00E676' : '#FF1744';
            
            // Add a subtle gradient fill underneath the curve
            const gradient = ctx.createLinearGradient(0, 0, 0, 140);
            gradient.addColorStop(0, sparklineData[sparklineData.length - 1] >= sparklineData[0] ? 'rgba(0, 230, 118, 0.2)' : 'rgba(255, 23, 68, 0.2)');
            gradient.addColorStop(1, 'rgba(0,0,0,0)');

            // Adjust bounds to ensure SL/TP/Entry lines are visible
            const minBound = Math.min(...sparklineData, pos.entry_price, pos.tp_price, pos.sl_price);
            const maxBound = Math.max(...sparklineData, pos.entry_price, pos.tp_price, pos.sl_price);
            const padding = (maxBound - minBound) * 0.1 || minBound * 0.05;

            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: sparklineData.map((_, i) => i),
                    datasets: [{
                        data: sparklineData,
                        borderColor: sparkColor,
                        backgroundColor: gradient,
                        borderWidth: 2,
                        tension: 0.3, // Smoother curve
                        pointRadius: 0,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { 
                        legend: { display: false }, 
                        tooltip: { enabled: false },
                        horizontalLines: {
                            lines: [
                                { value: pos.entry_price, color: 'rgba(255,255,255,0.6)', text: 'ENTRY', dash: [4, 4], width: 1.5 },
                                { value: pos.tp_price, color: 'rgba(0, 230, 118, 0.8)', text: 'TAKE PROFIT', dash: [3, 3], textColor: '#00E676', width: 1.5 },
                                { value: pos.sl_price, color: 'rgba(255, 23, 68, 0.8)', text: 'STOP LOSS', dash: [3, 3], textColor: '#FF1744', width: 1.5 }
                            ]
                        }
                    },
                    scales: {
                        x: { display: false },
                        y: { 
                            display: false, 
                            min: minBound - padding, 
                            max: maxBound + padding 
                        }
                    },
                    layout: { padding: { left: 10, right: 10, top: 10, bottom: 5 } },
                    animation: false
                }
            });
        }
    } catch (e) {
        console.error("Error rendering bot position:", e);
        container.innerHTML = '<p class="error">Failed to load trade data.</p>';
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
