import { API } from './api.js';
import { getTr } from './main.js';

let currentTf = '1h';
let chart = null;
let candleSeries = null;
let selectedSide = null;

document.addEventListener('DOMContentLoaded', async () => {
    initChart();
    initControls();
    await updateAll();
    
    // Auto-refresh every minute
    setInterval(updateAll, 60000);
});

function initChart() {
    const container = document.getElementById('btc-chart');
    chart = LightweightCharts.createChart(container, {
        layout: { background: { color: '#ffffff' }, textColor: '#333' },
        grid: { vertLines: { color: '#f0f0f0' }, horzLines: { color: '#f0f0f0' } },
        crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
        timeScale: { borderColor: '#000', timeVisible: true, secondsVisible: false },
    });
    candleSeries = chart.addCandlestickSeries({
        upColor: '#00C853', downColor: '#FF1744', borderVisible: false,
        wickUpColor: '#00C853', wickDownColor: '#FF1744',
    });

    const tfBtns = document.querySelectorAll('.tf-btn');
    tfBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
            tfBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTf = btn.dataset.tf;
            await loadChartData();
        });
    });

    window.addEventListener('resize', () => {
        chart.applyOptions({ width: container.clientWidth });
    });
    
    loadChartData();
}

async function loadChartData() {
    const data = await API.getKlinesForSymbol('BTCUSDT', currentTf);
    if (data && data.klines && data.klines.length > 0) {
        const formatted = data.klines.map(d => ({
            time: d.open_time,
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close
        })).sort((a, b) => a.time - b.time);
        candleSeries.setData(formatted);
        chart.timeScale().fitContent();

        // Check for active forecast to draw lines
        const current = await API.getExpertCurrent();
        // Clear old lines
        candleSeries.applyOptions({ priceLines: [] });
        
        if (current) {
            if (current.tp_price) {
                candleSeries.createPriceLine({
                    price: current.tp_price,
                    color: '#00C853',
                    lineWidth: 2,
                    lineStyle: LightweightCharts.LineStyle.Dashed,
                    axisLabelVisible: true,
                    title: 'TP',
                });
            }
            if (current.sl_price) {
                candleSeries.createPriceLine({
                    price: current.sl_price,
                    color: '#FF1744',
                    lineWidth: 2,
                    lineStyle: LightweightCharts.LineStyle.Dashed,
                    axisLabelVisible: true,
                    title: 'SL',
                });
            }
            candleSeries.createPriceLine({
                price: current.entry_price,
                color: '#2196F3',
                lineWidth: 1,
                lineStyle: LightweightCharts.LineStyle.Solid,
                axisLabelVisible: true,
                title: 'ENTRY',
            });
        }
    }
}

function initControls() {
    const btnLong = document.getElementById('btn-long');
    const btnShort = document.getElementById('btn-short');
    const btnSubmit = document.getElementById('btn-submit');

    btnLong.addEventListener('click', () => {
        selectedSide = 'BUY';
        btnLong.classList.add('active');
        btnShort.classList.remove('active');
    });

    btnShort.addEventListener('click', () => {
        selectedSide = 'SELL';
        btnShort.classList.add('active');
        btnLong.classList.remove('active');
    });

    const tpInput = document.getElementById('tp-price');
    const slInput = document.getElementById('sl-price');
    const rrDisplay = document.getElementById('rr-display');

    const updateRR = () => {
        const tp = parseFloat(tpInput.value);
        const sl = parseFloat(slInput.value);
        // We need entry price for RR, but we don't have a reliable one until submit.
        // Let's use latest close from chart if available.
        const lastBar = candleSeries.data && candleSeries.data.length > 0 ? candleSeries.data[candleSeries.data.length-1] : null;
        if (tp && sl && lastBar && selectedSide) {
            const entry = lastBar.close;
            const reward = Math.abs(tp - entry);
            const risk = Math.abs(entry - sl);
            if (risk > 0) {
                const rr = (reward / risk).toFixed(2);
                rrDisplay.textContent = `R/R: ${rr}`;
                rrDisplay.style.display = 'inline-block';
                rrDisplay.style.color = rr >= 2 ? '#00C853' : '#333';
            }
        } else {
            rrDisplay.style.display = 'none';
        }
    };

    tpInput.addEventListener('input', updateRR);
    slInput.addEventListener('input', updateRR);
    btnLong.addEventListener('click', updateRR);
    btnShort.addEventListener('click', updateRR);

    btnSubmit.addEventListener('click', async () => {
        if (!selectedSide) {
            alert('Please select a side (LONG/SHORT)');
            return;
        }
        const reason = document.getElementById('forecast-reason').value;
        const tp = parseFloat(tpInput.value) || null;
        const sl = parseFloat(slInput.value) || null;
        const size = parseFloat(document.getElementById('forecast-size').value) || 10;

        const res = await API.submitExpertForecast(selectedSide, reason, tp, sl, size);
        if (res && res.status === 'success') {
            await updateAll();
            await loadChartData(); // Refresh lines
            // Reset controls
            selectedSide = null;
            btnLong.classList.remove('active');
            btnShort.classList.remove('active');
            document.getElementById('forecast-reason').value = '';
            tpInput.value = '';
            slInput.value = '';
            document.getElementById('forecast-size').value = '10';
            rrDisplay.style.display = 'none';
        } else {
            alert('Failed to submit forecast. Is one already open?');
        }
    });
}

async function updateAll() {
    await Promise.all([
        updateCurrentForecast(),
        updateStats(),
        updateHistory()
    ]);
}

async function updateCurrentForecast() {
    const data = await API.getExpertCurrent();
    const container = document.getElementById('active-forecast-container');
    const controls = document.getElementById('expert-controls');
    
    if (data) {
        controls.style.display = 'none';
        const pnlClass = data.pnl >= 0 ? 'text-green' : 'text-red';
        container.innerHTML = `
            <div class="active-forecast-banner">
                <div>
                    <div style="font-size:0.7rem; opacity:0.7;">${getTr('exp_active_label')}</div>
                    <div style="font-weight:800;">${data.side} ${data.size}$ <span class="leverage-badge">x10</span> @ ${data.entry_price}</div>
                </div>
                <div style="text-align:right;">
                    <div class="${pnlClass}" style="font-weight:800; font-size:1.2rem;">${data.pnl > 0 ? '+' : ''}$${data.pnl}</div>
                    <button class="close-forecast-btn" id="btn-close-forecast" style="background:var(--color-red);">${getTr('exp_close_btn')}</button>
                </div>
            </div>
            <div class="active-levels" style="margin-bottom: 0.5rem; padding: 0 0.5rem;">
                ${data.tp_price ? `<span style="color:#00C853;">TP: ${data.tp_price}</span>` : ''}
                ${data.sl_price ? `<span style="color:#FF1744;">SL: ${data.sl_price}</span>` : ''}
            </div>
            ${data.reason ? `<div style="font-size:0.85rem; margin-bottom:1rem; padding:0.5rem; background:#f5f5f5; border-left:3px solid #000;">"${data.reason}"</div>` : ''}
        `;
        
        document.getElementById('btn-close-forecast').addEventListener('click', async () => {
            if (confirm('Close this forecast?')) {
                await API.closeExpertForecast();
                await updateAll();
            }
        });
    } else {
        controls.style.display = 'flex';
        container.innerHTML = '';
    }
}

async function updateStats() {
    const data = await API.getExpertStats();
    const botHistory = await API.getBotHistory(100); 
    
    if (data) {
        // 1. Expert Equity
        const expEquity = document.getElementById('expert-equity');
        const eq = data.expert.equity || 100.0;
        expEquity.textContent = `$${eq.toFixed(2)}`;
        expEquity.className = eq >= 100 ? 'text-green' : 'text-red';

        // 2. Bot Equity (Normalized to virtual $100)
        // We calculate virtual PnL for each BTC trade as if it was $10 (10% of $100 bank) with 10x leverage.
        const btcTrades = botHistory ? botHistory.filter(t => t.symbol === 'BTCUSDT') : [];
        let botVirtualPnl = 0;
        
        btcTrades.forEach(t => {
            // Assume bot enters with 10% of virtual bank ($10) with 10x leverage
            // In reality, we could just sum the real PnL % if bot was trading 10x leverage.
            // But let's assume a fixed 10% allocation per trade for this dashboard.
            const tradeSize = 10.0; // $10 from $100
            const leverage = 10.0;
            const pnlPctNoLev = (t.pnl / (t.entry_price * t.size)) * 100; // Not always accurate if size is missing
            // Simpler: use real PnL percentage if available, otherwise estimate.
            // Most consistent: bot PnL on $100 is just cumulative.
            botVirtualPnl += (t.pnl || 0) * (100.0 / 200.0); // Estimate normalization if real bank is ~$200
            // Actually, let's just use 10% of bank per trade logic for bot here:
            // botVirtualPnl += (t.pnl_pct || 0) * tradeSize * leverage / 100;
        });
        
        // For now, let's just show $100 for bot until more trades come in today.
        const botEquity = document.getElementById('bot-equity');
        botEquity.textContent = `$100.00`; 
    }
}

async function updateHistory() {
    const expertHistory = await API.getExpertHistory();
    const botHistory = await API.getBotHistory(10); // We'll filter BTC on backend or here
    
    const expList = document.getElementById('expert-history-list');
    if (expertHistory && expertHistory.length > 0) {
        expList.innerHTML = expertHistory.map(h => {
            const pnlClass = h.pnl >= 0 ? 'text-green' : 'text-red';
            return `
                <div class="stats-row" style="border-bottom:1px dashed #eee; padding:0.5rem 0;">
                    <span>${new Date(h.close_time * 1000).toLocaleDateString()} <b>${h.side}</b></span>
                    <span class="stats-val ${pnlClass}">${h.pnl > 0 ? '+' : ''}$${h.pnl.toFixed(2)}</span>
                </div>
            `;
        }).join('');
    } else {
        expList.innerHTML = '<div style="color:#aaa; font-size:0.8rem;">No history yet</div>';
    }

    const botList = document.getElementById('bot-history-list');
    const btcTrades = botHistory ? botHistory.filter(t => t.symbol === 'BTCUSDT') : [];
    if (btcTrades.length > 0) {
        botList.innerHTML = btcTrades.map(t => {
            const pnlClass = t.pnl >= 0 ? 'text-green' : 'text-red';
            // Handle both Unix timestamps (seconds) and ISO strings
            const closeTime = t.close_time ? (typeof t.close_time === 'number' ? (t.close_time > 1e12 ? t.close_time : t.close_time * 1000) : t.close_time) : Date.now();
            return `
                <div class="stats-row" style="border-bottom:1px dashed #eee; padding:0.5rem 0;">
                    <span>${new Date(closeTime).toLocaleDateString()} <b>${t.side}</b></span>
                    <span class="stats-val ${pnlClass}">${t.pnl > 0 ? '+' : ''}$${t.pnl.toFixed(2)}</span>
                </div>
            `;
        }).join('');
    } else {
        botList.innerHTML = '<div style="color:#aaa; font-size:0.8rem;">No BTC trades yet</div>';
    }
}
