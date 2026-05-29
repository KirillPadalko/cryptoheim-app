import { API } from './api.js';

let currentTf = '1h';
let chart = null;
let candleSeries = null;
let selectedSide = null;
let lastKnownPrice = null;
let roundEndTime = null;
let nextClickTarget = 'tp'; // Alternate between 'tp' and 'sl'
let tpPriceLine = null;
let slPriceLine = null;
let activeTpLine = null;
let activeSlLine = null;
let activeEntryLine = null;
let oldestCandleTime = 0;

function isLoggedIn() {
    const token = localStorage.getItem('cryptoheim_token');
    const userJson = localStorage.getItem('cryptoheim_user');
    return !!(token && userJson);
}

function isPro() {
    if (!isLoggedIn()) return false;
    try {
        const user = JSON.parse(localStorage.getItem('cryptoheim_user'));
        return user.is_pro === true || user.is_pro === 1 || user.is_pro === '1';
    } catch(e) { return false; }
}

function syncLoginState() {
    try {
        API.updateNavProfile();
    } catch(e) {}
    const btnSubmit = document.getElementById('btn-submit');
    if (btnSubmit) {
        if (!isLoggedIn()) {
            btnSubmit.innerText = "LOGIN TO PARTICIPATE";
            btnSubmit.style.background = "var(--color-yellow)";
            btnSubmit.style.color = "#000";
        } else {
            btnSubmit.innerText = "PLACE ORDER";
            btnSubmit.style.background = "";
            btnSubmit.style.color = "";
        }
    }
}


document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOMContentLoaded: Starting initialization");
    
    // Listen for expired sessions globally
    window.addEventListener('cryptoheim-session-expired', () => {
        console.warn("Session expired event received. Syncing login state.");
        syncLoginState();
    });

    try {
        syncLoginState();
    } catch(e) { console.error(e); }

    try {
        API.refreshUserSession().then(() => {
            try { renderChartMarkers(); } catch(e) {}
            try { updateAll(); } catch(e) {}
        });
    } catch(e) { console.error(e); }
    
    try {
        initChart();
        console.log("initChart: Success");
    } catch (e) { console.error("initChart failed:", e); }

    try {
        initChartInteraction();
        console.log("initChartInteraction: Success");
    } catch (e) { console.error("initChartInteraction failed:", e); }

    try {
        initControls();
        console.log("initControls: Success");
    } catch (e) { console.error("initControls failed:", e); }

    try {
        await loadChartData();
        console.log("loadChartData: Success");
    } catch (e) { console.error("loadChartData failed:", e); }
    
    // updateAll calls updateHero, updateBattleFeed, updateLivePrice
    try {
        await updateAll();
        setInterval(updateAll, 5000);
        setInterval(updateLivePrice, 5000);
    } catch (e) { console.error("Update loop failed:", e); }
});

// ── CHART ──────────────────────────────────────────────
function initChart() {
    const container = document.getElementById('btc-chart');
    chart = LightweightCharts.createChart(container, {
        layout: { background: { color: '#ffffff' }, textColor: '#333' },
        grid: { vertLines: { color: '#f5f5f5' }, horzLines: { color: '#f5f5f5' } },
        crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
        timeScale: { borderColor: '#000', timeVisible: true, secondsVisible: false },
        rightPriceScale: { borderColor: '#000' },
    });
    candleSeries = chart.addCandlestickSeries({
        upColor: '#00C853', downColor: '#FF1744',
        borderVisible: false,
        wickUpColor: '#00C853', wickDownColor: '#FF1744',
    });

    document.querySelectorAll('.evb-tf-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            document.querySelectorAll('.evb-tf-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTf = btn.dataset.tf;
            await loadChartData();
        });
    });

    window.addEventListener('resize', () => {
        chart.applyOptions({ width: container.clientWidth });
    });

    // loadChartData is called in DOMContentLoaded
}


function initChartInteraction() {
    if (!chart) {
        console.error("[Interaction] Chart not initialized");
        return;
    }

    console.log("[Interaction] Subscribing to chart clicks...");
    
    // Global debug click
    document.addEventListener('click', (e) => {
        console.log("[Global Click] Target:", e.target, "Classes:", e.target.className);
    });
    chart.subscribeClick((param) => {
        if (!param.point || !candleSeries) return;

        const price = candleSeries.coordinateToPrice(param.point.y);
        if (price === null) return;

        const priceFixed = parseFloat(price.toFixed(2));
        const x = param.point.x;
        const y = param.point.y;
        
        const container = document.getElementById('btc-chart');
        const rect = container.getBoundingClientRect();

        if (nextClickTarget === 'tp') {
            const input = document.getElementById('tp-price');
            if (input) {
                input.value = priceFixed;
                input.dispatchEvent(new Event('input'));
                showToastAtCursor(rect.left + x, rect.top + y, `TP SET: $${priceFixed}`);
                nextClickTarget = 'sl';
                updateChartLines();
            }
        } else {
            const input = document.getElementById('sl-price');
            if (input) {
                input.value = priceFixed;
                input.dispatchEvent(new Event('input'));
                showToastAtCursor(rect.left + x, rect.top + y, `SL SET: $${priceFixed}`);
                nextClickTarget = 'tp';
                updateChartLines();
            }
        }
    });

    // Crosshair tooltip for UX
    const tooltip = document.createElement('div');
    tooltip.style = 'position:absolute; padding:4px 8px; background:rgba(0,0,0,0.8); color:#fff; border-radius:4px; pointer-events:none; z-index:1000; font-size:12px; font-weight:bold; display:none; transform:translate(15px, 15px); transition:opacity 0.1s;';
    document.body.appendChild(tooltip);

    chart.subscribeCrosshairMove((param) => {
        if (!param.point || !candleSeries) {
            tooltip.style.display = 'none';
            return;
        }
        
        const price = candleSeries.coordinateToPrice(param.point.y);
        if (price === null) return;

        const container = document.getElementById('btc-chart');
        const rect = container.getBoundingClientRect();
        
        tooltip.style.left = `${rect.left + param.point.x + window.pageXOffset}px`;
        tooltip.style.top = `${rect.top + param.point.y + window.pageYOffset}px`;
        
        const targetStr = nextClickTarget === 'tp' ? 'TAKE PROFIT' : 'STOP LOSS';
        const targetColor = nextClickTarget === 'tp' ? '#00C853' : '#FF1744';
        
        tooltip.innerHTML = `Click to set <span style="color:${targetColor}">${targetStr}</span><br/>$${price.toFixed(2)}`;
        tooltip.style.display = 'block';
    });

    // Debug helper
    window.expertDebug = {
        getChart: () => chart,
        getSeries: () => candleSeries,
        setTarget: (t) => nextClickTarget = t
    };
}

function showToastAtCursor(x, y, text) {
    const toast = document.createElement('div');
    toast.className = 'evb-chart-toast';
    // Use scroll offsets to ensure it works even if page is scrolled
    const absX = x + window.pageXOffset;
    const absY = y + window.pageYOffset;
    toast.style.left = `${absX}px`;
    toast.style.top = `${absY}px`;
    toast.textContent = text;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 1200);
}

async function loadChartData() {
    console.log(`[Chart] Loading data for ${currentTf}...`);
    const data = await API.getKlinesForSymbol('BTCUSDT', currentTf, 1000);
    if (!data?.klines?.length) {
        console.warn("[Chart] No kline data received");
        return;
    }
    console.log(`[Chart] Received ${data.klines.length} candles`);

    const formatted = data.klines.map(d => ({
        time: d.open_time, open: d.open, high: d.high, low: d.low, close: d.close
    })).sort((a, b) => a.time - b.time);

    candleSeries.setData(formatted);
    chart.timeScale().fitContent();

    const last = formatted[formatted.length - 1];
    if (last) {
        lastKnownPrice = last.close;
        const livePriceEl = document.getElementById('btc-live-price');
        if (livePriceEl) {
            livePriceEl.textContent = '$' + last.close.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        updateActivePnLDisplay();
    }

    // Draw markers
    oldestCandleTime = formatted.length > 0 ? formatted[0].time : 0;
    await renderChartMarkers();

    // Draw active forecast lines
    const current = await API.getExpertCurrent();
    
    // Clear old active lines if present
    if (activeTpLine) { candleSeries.removePriceLine(activeTpLine); activeTpLine = null; }
    if (activeSlLine) { candleSeries.removePriceLine(activeSlLine); activeSlLine = null; }
    if (activeEntryLine) { candleSeries.removePriceLine(activeEntryLine); activeEntryLine = null; }

    if (current && isLoggedIn() && candleSeries) {
        if (current.tp_price) {
            activeTpLine = candleSeries.createPriceLine({
                price: current.tp_price, color: '#00C853', lineWidth: 2,
                lineStyle: LightweightCharts.LineStyle.Dashed, axisLabelVisible: true, title: 'TP'
            });
        }
        if (current.sl_price) {
            activeSlLine = candleSeries.createPriceLine({
                price: current.sl_price, color: '#FF1744', lineWidth: 2,
                lineStyle: LightweightCharts.LineStyle.Dashed, axisLabelVisible: true, title: 'SL'
            });
        }
        activeEntryLine = candleSeries.createPriceLine({
            price: current.entry_price, color: '#2962FF', lineWidth: 1,
            lineStyle: LightweightCharts.LineStyle.Solid, axisLabelVisible: true, title: 'ENTRY'
        });
    }

}

function getTfSeconds(tf) {
    if (!tf) return 3600;
    const unit = tf.slice(-1).toLowerCase();
    const val = parseInt(tf.slice(0, -1), 10);
    if (isNaN(val)) return 3600;
    if (unit === 'm') return val * 60;
    if (unit === 'h') return val * 3600;
    if (unit === 'd') return val * 86400;
    return 3600;
}

function toSeconds(ts) {
    if (!ts) return 0;
    if (typeof ts === 'number') {
        return ts > 1e11 ? Math.floor(ts / 1000) : ts;
    }
    const parsed = Number(ts);
    if (!isNaN(parsed) && parsed > 0) {
        return parsed > 1e11 ? Math.floor(parsed / 1000) : parsed;
    }
    return Math.floor(new Date(ts).getTime() / 1000);
}

async function renderChartMarkers() {
    const [expHistory, botHistory, joHistory, expCurrent, botPositions, joCurrent] = await Promise.all([
        API.getExpertHistory(100).catch(() => []),
        API.getBotHistory(200).catch(() => []),
        API.getExpertHistory(100, 'JO_BOT').catch(() => []),
        API.getExpertCurrent().catch(() => null),
        API.getBotPositions().catch(() => []),
        API.getExpertCurrent('JO_BOT').catch(() => null)
    ]);
    
    const events = [];
    
    // 1. Closed Expert History
    if (isLoggedIn()) {
        (expHistory || []).forEach(h => {
            if (h.open_time) {
                events.push({
                    time: toSeconds(h.open_time),
                    actor: 'user',
                    type: 'IN',
                    side: h.side
                });
            }
            if (h.close_time) {
                events.push({
                    time: toSeconds(h.close_time),
                    actor: 'user',
                    type: 'OUT',
                    side: h.side
                });
            }
        });

        // 2. Active Open Expert Forecast
        if (expCurrent && expCurrent.open_time) {
            events.push({
                time: toSeconds(expCurrent.open_time),
                actor: 'user',
                type: 'IN',
                side: expCurrent.side
            });
        }
    }

    // 3. Closed Bot History
    (botHistory || []).filter(t => t.symbol === 'BTCUSDT').forEach(t => {
        const side = ['BUY','LONG'].includes(String(t.side).toUpperCase()) ? 'BUY' : 'SELL';
        if (t.open_time) {
            events.push({
                time: toSeconds(t.open_time),
                actor: 'bot',
                type: 'IN',
                side: side
            });
        }
        if (t.close_time) {
            events.push({
                time: toSeconds(t.close_time),
                actor: 'bot',
                type: 'OUT',
                side: side
            });
        }
    });

    // 4. Active Open Bot Positions
    (botPositions || []).filter(t => t.symbol === 'BTCUSDT').forEach(t => {
        const side = ['BUY','LONG'].includes(String(t.side).toUpperCase()) ? 'BUY' : 'SELL';
        if (t.open_time) {
            events.push({
                time: toSeconds(t.open_time),
                actor: 'bot',
                type: 'IN',
                side: side
            });
        }
    });

    // 5. Closed Jo Bot History
    (joHistory || []).forEach(h => {
        if (h.open_time) {
            events.push({
                time: toSeconds(h.open_time),
                actor: 'jo',
                type: 'IN',
                side: h.side
            });
        }
        if (h.close_time) {
            events.push({
                time: toSeconds(h.close_time),
                actor: 'jo',
                type: 'OUT',
                side: h.side
            });
        }
    });

    // 6. Active Open Jo Bot Position
    if (joCurrent && joCurrent.open_time) {
        events.push({
            time: toSeconds(joCurrent.open_time),
            actor: 'jo',
            type: 'IN',
            side: joCurrent.side
        });
    }

    const tfSeconds = getTfSeconds(currentTf);

    // Group events by candle open time, actor, and event type
    const grouped = {};
    events.forEach(e => {
        const candleTime = Math.floor(e.time / tfSeconds) * tfSeconds;
        // Filter out any events older than the oldest loaded candle to prevent clamping on the left boundary
        if (oldestCandleTime && candleTime < oldestCandleTime) return;

        const key = `${candleTime}_${e.actor}_${e.type}`;
        if (!grouped[key]) {
            grouped[key] = {
                candleTime,
                actor: e.actor,
                type: e.type,
                count: 0
            };
        }
        grouped[key].count++;
    });

    const uniqueMarkers = [];

    // Convert grouped events into Lightweight Charts markers
    Object.values(grouped).forEach(g => {
        if (g.actor === 'user') {
            if (g.type === 'IN') {
                uniqueMarkers.push({
                    time: g.candleTime,
                    position: 'belowBar',
                    color: '#2962FF',
                    shape: 'arrowUp',
                    text: g.count === 1 ? 'YOU IN' : `x${g.count} IN`,
                    size: 2
                });
            } else {
                uniqueMarkers.push({
                    time: g.candleTime,
                    position: 'aboveBar',
                    color: '#2962FF',
                    shape: 'arrowDown',
                    text: g.count === 1 ? 'YOU OUT' : `x${g.count} OUT`,
                    size: 2
                });
            }
        } else if (g.actor === 'bot') {
            if (g.type === 'IN') {
                uniqueMarkers.push({
                    time: g.candleTime,
                    position: 'belowBar',
                    color: '#000',
                    shape: 'square',
                    text: g.count === 1 ? 'BOT IN' : `BOT x${g.count} IN`,
                    size: 1
                });
            } else {
                uniqueMarkers.push({
                    time: g.candleTime,
                    position: 'aboveBar',
                    color: '#000',
                    shape: 'circle',
                    text: g.count === 1 ? 'BOT OUT' : `BOT x${g.count} OUT`,
                    size: 1
                });
            }
        } else if (g.actor === 'jo') {
            if (g.type === 'IN') {
                uniqueMarkers.push({
                    time: g.candleTime,
                    position: 'belowBar',
                    color: '#7b1fa2',
                    shape: 'arrowUp',
                    text: g.count === 1 ? 'JO IN' : `JO x${g.count} IN`,
                    size: 1.5
                });
            } else {
                uniqueMarkers.push({
                    time: g.candleTime,
                    position: 'aboveBar',
                    color: '#7b1fa2',
                    shape: 'arrowDown',
                    text: g.count === 1 ? 'JO OUT' : `JO x${g.count} OUT`,
                    size: 1.5
                });
            }
        }
    });

    // Sort markers chronologically, and deterministically by text to avoid layering jitter
    uniqueMarkers.sort((a, b) => {
        if (a.time !== b.time) return a.time - b.time;
        return a.text.localeCompare(b.text);
    });

    console.log(`[Chart] Generated ${uniqueMarkers.length} consolidated markers for timeframe ${currentTf}`);
    candleSeries.setMarkers(uniqueMarkers);
    
    if (uniqueMarkers.length > 0) console.log(`[Chart] First marker time: ${uniqueMarkers[0].time}`);
    const candleData = candleSeries.data ? candleSeries.data() : [];
    if (candleData && candleData.length > 0) {
        console.log(`[Chart] First candle time: ${candleData[0].time}`);
    }
}

async function updateLivePrice() {
    const data = await API.getKlinesForSymbol('BTCUSDT', '1h', 2);
    if (!data?.klines?.length) return;
    const sorted = data.klines.sort((a, b) => a.open_time - b.open_time);
    const last = sorted[sorted.length - 1];
    const prev = sorted[sorted.length - 2];
    if (!last) return;

    lastKnownPrice = last.close;
    const el = document.getElementById('btc-live-price');
    el.textContent = '$' + last.close.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const changeEl = document.getElementById('btc-price-change');
    if (prev && changeEl) {
        const pct = ((last.close - prev.close) / prev.close * 100).toFixed(2);
        const pos = pct >= 0;
        changeEl.textContent = (pos ? '+' : '') + pct + '%';
        changeEl.className = 'evb-price-change ' + (pos ? 'pos' : 'neg');
    }
    updateTPSLPcts();
    updateActivePnLDisplay();
}

// ── CONTROLS ───────────────────────────────────────────
function initControls() {
    const btnLong  = document.getElementById('btn-long');
    const btnShort = document.getElementById('btn-short');
    const btnSubmit = document.getElementById('btn-submit');
    const tpInput  = document.getElementById('tp-price');
    const slInput  = document.getElementById('sl-price');
    const sizeInput = document.getElementById('forecast-size');

    if (btnSubmit && !isLoggedIn()) {
        btnSubmit.innerText = "LOGIN TO PARTICIPATE";
        btnSubmit.style.background = "var(--color-yellow)";
        btnSubmit.style.color = "#000";
    }

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


    // Quick size buttons
    document.querySelectorAll('.evb-quick-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.dataset.size === 'max') {
                sizeInput.value = 100;
            } else {
                sizeInput.value = btn.dataset.size;
            }
        });
    });

    tpInput.addEventListener('input', () => { updateRR(); updateChartLines(); });
    slInput.addEventListener('input', () => { updateRR(); updateChartLines(); });

    btnSubmit.addEventListener('click', async () => {
        if (!isLoggedIn()) { window.location.href = "pro.html"; return; }
        if (!selectedSide) { alert('Select LONG or SHORT first.'); return; }
        
        if (btnSubmit.disabled) return;
        btnSubmit.disabled = true;
        const originalText = btnSubmit.innerText;
        btnSubmit.innerText = "SUBMITTING...";

        try {
            const size = parseFloat(sizeInput.value) || 10;
            const tp   = parseFloat(tpInput.value) || null;
            const sl   = parseFloat(slInput.value) || null;
            const res  = await API.submitExpertForecast(selectedSide, '', tp, sl, size);
            if (res?.status === 'success') {
                resetControls();
                await updateAll();
                await loadChartData();
            } else if (res?.code === 401) {
                alert('Your session has expired. Please log in again.');
                window.location.href = "pro.html";
            } else {
                alert('Failed to place trade. Is one already open?');
            }
        } catch(e) {
            console.error(e);
            alert('An error occurred during submission.');
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.innerText = originalText;
        }
    });
}


function updateTPSLPcts() {
    if (!lastKnownPrice) return;
    const tp = parseFloat(document.getElementById('tp-price').value);
    const sl = parseFloat(document.getElementById('sl-price').value);
    const tpPct = document.getElementById('tp-pct');
    const slPct = document.getElementById('sl-pct');
    if (tp) {
        const pct = ((tp - lastKnownPrice) / lastKnownPrice * 100).toFixed(2);
        tpPct.textContent = (pct >= 0 ? '+' : '') + pct + '%  →  $' + tp.toFixed(2);
        tpPct.style.color = pct >= 0 ? '#00C853' : '#FF1744';
    } else { tpPct.textContent = ''; }
    if (sl) {
        const pct = ((sl - lastKnownPrice) / lastKnownPrice * 100).toFixed(2);
        slPct.textContent = (pct >= 0 ? '+' : '') + pct + '%  →  $' + sl.toFixed(2);
        slPct.style.color = pct >= 0 ? '#00C853' : '#FF1744';
    } else { slPct.textContent = ''; }
}

function updateRR() {
    updateTPSLPcts();
    const tpInput = document.getElementById('tp-price');
    const slInput = document.getElementById('sl-price');
    if (!tpInput || !slInput) return;

    const tp = parseFloat(tpInput.value);
    const sl = parseFloat(slInput.value);
    const rrEl = document.getElementById('rr-display');
    if (tp && sl && lastKnownPrice) {
        const reward = Math.abs(tp - lastKnownPrice);
        const risk   = Math.abs(lastKnownPrice - sl);
        if (risk > 0) {
            const rr = (reward / risk).toFixed(2);
            rrEl.textContent = 'R/R: ' + rr;
            rrEl.style.display = 'inline-block';
            rrEl.style.borderColor = rr >= 2 ? '#00C853' : '#000';
            rrEl.style.color = rr >= 2 ? '#00C853' : '#000';
        }
    } else {
        rrEl.style.display = 'none';
    }
}

function updateChartLines() {
    if (!candleSeries) return;

    const tpInput = document.getElementById('tp-price');
    const slInput = document.getElementById('sl-price');
    if (!tpInput || !slInput) return;

    const tpVal = parseFloat(tpInput.value);
    const slVal = parseFloat(slInput.value);

    // Remove old lines
    if (tpPriceLine) {
        candleSeries.removePriceLine(tpPriceLine);
        tpPriceLine = null;
    }
    if (slPriceLine) {
        candleSeries.removePriceLine(slPriceLine);
        slPriceLine = null;
    }

    if (tpVal) {
        tpPriceLine = candleSeries.createPriceLine({
            price: tpVal,
            color: '#00C853',
            lineWidth: 2,
            lineStyle: 2, // Dashed
            axisLabelVisible: true,
            title: 'Take Profit',
        });
    }
    if (slVal) {
        slPriceLine = candleSeries.createPriceLine({
            price: slVal,
            color: '#FF1744',
            lineWidth: 2,
            lineStyle: 2, // Dashed
            axisLabelVisible: true,
            title: 'Stop Loss',
        });
    }
}

function resetControls() {
    selectedSide = null;
    document.getElementById('btn-long').classList.remove('active');
    document.getElementById('btn-short').classList.remove('active');
    document.getElementById('forecast-size').value = '10';
    document.getElementById('tp-price').value = '';
    document.getElementById('sl-price').value = '';
    document.getElementById('tp-pct').textContent = '';
    document.getElementById('sl-pct').textContent = '';
    document.getElementById('rr-display').style.display = 'none';
    updateChartLines();
}



// ── MAIN UPDATE ────────────────────────────────────────
async function updateAll() {
    await Promise.all([
        updateActiveForecast(),
        updateBattleFeed(),
        updateUserStats(),
        updateLeaderboard(),
        renderChartMarkers().catch(e => console.error("renderChartMarkers failed:", e))
    ]);
}



async function updateActiveForecast() {
    const data = await API.getExpertCurrent();
    window.activeForecast = data;
    const banner = document.getElementById('active-position-banner');
    const card   = document.getElementById('action-card');
    if (!banner || !card) return;

    if (data && data.status !== 'error' && data.code !== 401) {
        const pnl = data.pnl || 0;
        const pos = pnl >= 0;
        
        // Hide standard trade form card
        card.style.display = 'none';
        
        // Show banner/widget container
        banner.style.display = 'block';
        
        // Check if the card is already rendered for this trade ID to prevent wiping out input states while typing
        const existingCard = banner.querySelector(`.evb-active-banner-card[data-trade-id="${data.id}"]`);
        if (!existingCard) {
            banner.innerHTML = `
                <div class="evb-active-banner-card" data-trade-id="${data.id}">
                    <div class="evb-active-header">
                        <span class="evb-active-title">👤 YOUR ACTIVE POSITION</span>
                        <span class="evb-active-side-badge ${data.side === 'BUY' ? 'long' : 'short'}">
                            ${data.side === 'BUY' ? 'LONG' : 'SHORT'}
                        </span>
                    </div>
                    
                    <div class="evb-active-info-row">
                        <span class="evb-active-size">$${data.size} <span class="evb-leverage-badge">×10</span></span>
                        <span class="evb-active-entry">Entry: $${data.entry_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>

                    <div class="evb-active-pnl-wrap">
                        <div class="evb-active-pnl-val ${pos ? 'pos' : 'neg'}" id="active-pnl-display">
                            ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}
                        </div>
                        <div class="evb-active-pnl-lbl">Unrealized PnL</div>
                    </div>

                    <div class="evb-active-inputs-label">Adjust Take Profit / Stop Loss</div>
                    <div class="evb-active-input-row">
                        <div class="evb-active-input-col">
                            <span class="tp-lbl">TAKE PROFIT</span>
                            <input type="number" class="evb-active-input tp" id="active-tp-input" value="${data.tp_price || ''}" placeholder="Not Set" step="any">
                            <span class="evb-active-input-pct" id="active-tp-pct"></span>
                        </div>
                        <div class="evb-active-input-col">
                            <span class="sl-lbl">STOP LOSS</span>
                            <input type="number" class="evb-active-input sl" id="active-sl-input" value="${data.sl_price || ''}" placeholder="Not Set" step="any">
                            <span class="evb-active-input-pct" id="active-sl-pct"></span>
                        </div>
                    </div>

                    <div class="evb-active-actions">
                        <button class="evb-active-update-btn" id="btn-update-tpsl" disabled>
                            <span>💾</span> UPDATE SL/TP
                        </button>
                        <button class="evb-active-close-btn" id="btn-close-forecast">
                            <span>⚡</span> CLOSE TRADE
                        </button>
                    </div>
                </div>
            `;
            
            // Set up event listeners for inputs and buttons
            const tpInput = document.getElementById('active-tp-input');
            const slInput = document.getElementById('active-sl-input');
            const tpPctEl = document.getElementById('active-tp-pct');
            const slPctEl = document.getElementById('active-sl-pct');
            const updateBtn = document.getElementById('btn-update-tpsl');
            const closeBtn = document.getElementById('btn-close-forecast');
            
            const updateActiveTPSLPcts = () => {
                const tpVal = parseFloat(tpInput.value) || null;
                const slVal = parseFloat(slInput.value) || null;
                
                // TP calculation & dynamic lines
                if (tpVal) {
                    const diff = tpVal - data.entry_price;
                    const pct = (diff / data.entry_price) * 100;
                    const leverage = 10.0;
                    const expectedPnl = data.size * (pct / 100) * leverage * (data.side === 'BUY' ? 1 : -1);
                    
                    tpPctEl.textContent = `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}% (${expectedPnl >= 0 ? '+' : ''}$${expectedPnl.toFixed(2)})`;
                    tpPctEl.style.color = expectedPnl >= 0 ? '#00C853' : '#FF1744';
                    
                    // Update chart line dynamically
                    if (candleSeries) {
                        if (activeTpLine) candleSeries.removePriceLine(activeTpLine);
                        activeTpLine = candleSeries.createPriceLine({
                            price: tpVal, color: '#00C853', lineWidth: 2,
                            lineStyle: LightweightCharts.LineStyle.Dashed, axisLabelVisible: true, title: 'TP'
                        });
                    }
                } else {
                    tpPctEl.textContent = 'Not Set';
                    tpPctEl.style.color = '#888';
                    if (candleSeries && activeTpLine) {
                        candleSeries.removePriceLine(activeTpLine);
                        activeTpLine = null;
                    }
                }
                
                // SL calculation & dynamic lines
                if (slVal) {
                    const diff = slVal - data.entry_price;
                    const pct = (diff / data.entry_price) * 100;
                    const leverage = 10.0;
                    const expectedPnl = data.size * (pct / 100) * leverage * (data.side === 'BUY' ? 1 : -1);
                    
                    slPctEl.textContent = `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}% (${expectedPnl >= 0 ? '+' : ''}$${expectedPnl.toFixed(2)})`;
                    slPctEl.style.color = expectedPnl >= 0 ? '#00C853' : '#FF1744';
                    
                    // Update chart line dynamically
                    if (candleSeries) {
                        if (activeSlLine) candleSeries.removePriceLine(activeSlLine);
                        activeSlLine = candleSeries.createPriceLine({
                            price: slVal, color: '#FF1744', lineWidth: 2,
                            lineStyle: LightweightCharts.LineStyle.Dashed, axisLabelVisible: true, title: 'SL'
                        });
                    }
                } else {
                    slPctEl.textContent = 'Not Set';
                    slPctEl.style.color = '#888';
                    if (candleSeries && activeSlLine) {
                        candleSeries.removePriceLine(activeSlLine);
                        activeSlLine = null;
                    }
                }
                
                // Check if different from active database values to toggle "Save" button
                const origTp = data.tp_price || null;
                const origSl = data.sl_price || null;
                const currentTpInputVal = tpInput.value.trim() === '' ? null : parseFloat(tpInput.value);
                const currentSlInputVal = slInput.value.trim() === '' ? null : parseFloat(slInput.value);
                
                const hasChanges = currentTpInputVal !== origTp || currentSlInputVal !== origSl;
                updateBtn.disabled = !hasChanges;
            };
            
            tpInput.addEventListener('input', updateActiveTPSLPcts);
            slInput.addEventListener('input', updateActiveTPSLPcts);
            
            // Initial calculations
            updateActiveTPSLPcts();
            
            updateBtn.addEventListener('click', async () => {
                const currentTpInputVal = tpInput.value.trim() === '' ? null : parseFloat(tpInput.value);
                const currentSlInputVal = slInput.value.trim() === '' ? null : parseFloat(slInput.value);
                
                updateBtn.disabled = true;
                updateBtn.textContent = 'SAVING...';
                
                const res = await API.updateExpertForecast(currentTpInputVal, currentSlInputVal);
                if (res?.status === 'success') {
                    // Update local copy to sync the UI comparison
                    data.tp_price = currentTpInputVal;
                    data.sl_price = currentSlInputVal;
                    updateBtn.innerHTML = '<span>💾</span> UPDATE SL/TP';
                    updateBtn.disabled = true;
                    showToastAtCursor(window.innerWidth / 2, window.innerHeight / 2, 'ACTIVE TRADE UPDATED successfully');
                    await updateAll();
                    await loadChartData();
                } else if (res?.code === 401) {
                    alert('Your session has expired. Please log in again.');
                    window.location.href = "pro.html";
                } else {
                    alert('Failed to update Stop Loss / Take Profit.');
                    updateBtn.innerHTML = '<span>💾</span> UPDATE SL/TP';
                    updateBtn.disabled = false;
                }
            });
            
            closeBtn.addEventListener('click', async () => {
                if (confirm('Close this position?')) {
                    const res = await API.closeExpertForecast();
                    if (res?.code === 401) {
                        alert('Your session has expired. Please log in again.');
                        window.location.href = "pro.html";
                        return;
                    }
                    banner.style.display = 'none';
                    banner.innerHTML = '';
                    card.style.display = 'block';
                    
                    // Clear lines
                    if (activeTpLine) { candleSeries.removePriceLine(activeTpLine); activeTpLine = null; }
                    if (activeSlLine) { candleSeries.removePriceLine(activeSlLine); activeSlLine = null; }
                    if (activeEntryLine) { candleSeries.removePriceLine(activeEntryLine); activeEntryLine = null; }
                    
                    await updateAll();
                    await loadChartData();
                }
            });
        } else {
            // Card is already rendered, just update the live unrealized PnL field
            updateActivePnLDisplay();
        }
        
        // Ensure initial/updated render has correct PnL based on live price
        updateActivePnLDisplay();
        
        // Update status badge
        const badge = document.getElementById('user-status-badge');
        if (badge) { badge.textContent = 'IN TRADE'; badge.classList.add('active'); }
    } else {
        window.activeForecast = null;
        // No active trade, reset and show normal action card
        banner.style.display = 'none';
        banner.innerHTML = '';
        card.style.display = 'block';
        
        const badge = document.getElementById('user-status-badge');
        if (badge) { badge.textContent = 'READY'; badge.classList.remove('active'); }
        
        // Clear active lines
        if (activeTpLine) { candleSeries.removePriceLine(activeTpLine); activeTpLine = null; }
        if (activeSlLine) { candleSeries.removePriceLine(activeSlLine); activeSlLine = null; }
        if (activeEntryLine) { candleSeries.removePriceLine(activeEntryLine); activeEntryLine = null; }
        
        syncLoginState();
    }

    // Bot status
    const botStats = await API.getExpertStats();
    const botPos = botStats?.bot?.current_position;
    const botBadge = document.getElementById('bot-status-badge');
    if (botBadge) {
        if (botPos) { botBadge.textContent = 'IN TRADE'; botBadge.classList.add('active'); }
        else { botBadge.textContent = 'STANDBY'; botBadge.classList.remove('active'); }
    }

    // Update live competitors mind card
    const chMind = botStats?.bot?.mind;
    const joMind = botStats?.jo?.mind;

    // 1. CH Bot Mind Updates
    const chStatusEl = document.getElementById('ch-mind-status');
    if (chStatusEl) {
        if (botPos) {
            chStatusEl.textContent = 'IN TRADE';
            chStatusEl.classList.add('active');
            chStatusEl.classList.remove('standby');
        } else {
            chStatusEl.textContent = 'STANDBY';
            chStatusEl.classList.remove('active');
            chStatusEl.classList.add('standby');
        }
    }
    if (chMind) {
        setEl('ch-mind-bias', chMind.bias || 'NEUTRAL');
        setEl('ch-mind-confidence', chMind.confidence || '0%');
        setEl('ch-mind-atr', chMind.atr_noise_15m || '0.00%');
        setEl('ch-mind-desc', chMind.state_desc || 'Scanning...');
    }

    // 2. Jo Bot Mind Updates
    const joPos = botStats?.jo?.current_position;
    const joStatusEl = document.getElementById('jo-mind-status');
    if (joStatusEl) {
        if (joPos) {
            joStatusEl.textContent = 'IN TRADE';
            joStatusEl.classList.add('active');
            joStatusEl.classList.remove('standby');
        } else {
            joStatusEl.textContent = 'STANDBY';
            joStatusEl.classList.remove('active');
            joStatusEl.classList.add('standby');
        }
    }
    if (joMind) {
        setEl('jo-mind-inertia', joMind.inertia !== undefined ? joMind.inertia.toFixed(2) : '—');
        setEl('jo-mind-streak', joMind.noise_streak !== undefined ? `${joMind.noise_streak} bars` : '—');
        
        if (joMind.breakout_timer > 0) {
            setEl('jo-mind-quarantine', `LOCKED (${joMind.breakout_timer} bars)`);
            const qEl = document.getElementById('jo-mind-quarantine');
            if (qEl) qEl.style.color = '#FF1744';
        } else {
            setEl('jo-mind-quarantine', 'SAFE / ACTIVE');
            const qEl = document.getElementById('jo-mind-quarantine');
            if (qEl) qEl.style.color = '#00C853';
        }

        const suppStr = joMind.p_supp ? `$${Math.round(joMind.p_supp)}` : '—';
        const resStr = joMind.p_res ? `$${Math.round(joMind.p_res)}` : '—';
        setEl('jo-mind-levels', `Support: ${suppStr} | Resistance: ${resStr}`);
    }
}

function updateActivePnLDisplay() {
    const data = window.activeForecast;
    if (!data || !lastKnownPrice) return;
    
    const pnlDisplay = document.getElementById('active-pnl-display');
    if (!pnlDisplay) return;
    
    const entryPrice = data.entry_price;
    let priceDiff = lastKnownPrice - entryPrice;
    if (data.side === 'SELL') {
        priceDiff = -priceDiff;
    }
    const leverage = 10.0;
    const pnlPct = (priceDiff / entryPrice) * 100 * leverage;
    const pnl = (data.size || 100) * (pnlPct / 100);
    const pos = pnl >= 0;
    
    pnlDisplay.textContent = `${pos ? '+' : ''}$${pnl.toFixed(2)}`;
    pnlDisplay.className = `evb-active-pnl-val ${pos ? 'pos' : 'neg'}`;
}

async function updateBattleFeed() {
    const [expHistory, botHistory, joHistory, expCurrent, botPositions, joCurrent] = await Promise.all([
        API.getExpertHistory(10).catch(() => []),
        API.getBotHistory(30).catch(() => []),
        API.getExpertHistory(20, 'JO_BOT').catch(() => []),
        API.getExpertCurrent().catch(() => null),
        API.getBotPositions().catch(() => []),
        API.getExpertCurrent('JO_BOT').catch(() => null)
    ]);

    const feed = [];

    // Open trades are excluded from BATTLE LOG (only closed trades are recorded here)

    // 3. Closed User History
    if (isLoggedIn()) {
        (expHistory || []).forEach(h => {
            feed.push({
                time: h.close_time > 1e12 ? h.close_time / 1000 : h.close_time,
                actor: 'user',
                action: h.side === 'BUY' ? 'BUY' : 'SELL',
                pair: 'BTC/USDT',
                pnl: h.pnl || 0,
                isOpen: false
            });
        });
    }

    // 4. Closed Bot History
    const btcBot = (botHistory || []).filter(t => t.symbol === 'BTCUSDT').slice(0, 10);
    btcBot.forEach(t => {
        feed.push({
            time: typeof t.close_time === 'number'
                ? (t.close_time > 1e12 ? t.close_time / 1000 : t.close_time)
                : Date.now() / 1000,
            actor: 'bot',
            action: ['BUY','LONG'].includes(String(t.side).toUpperCase()) ? 'BUY' : 'SELL',
            pair: 'BTC/USDT',
            pnl: t.pnl || 0,
            isOpen: false
        });
    });

    // 5. Closed Jo Bot History
    (joHistory || []).forEach(h => {
        feed.push({
            time: h.close_time > 1e12 ? h.close_time / 1000 : h.close_time,
            actor: 'jo',
            action: h.side === 'BUY' ? 'BUY' : 'SELL',
            pair: 'BTC/USDT',
            pnl: h.pnl || 0,
            isOpen: false
        });
    });


    // Sort feed chronologically to run our rivalry scanner over the timeline
    const sortedTimeline = [...feed].sort((a, b) => a.time - b.time);
    const systemEvents = [];
    let userPnl = 0, botPnl = 0, joPnl = 0;

    // Helper to calculate ranking lists
    function getRanks(up, bp, jp) {
        const arr = [
            { id: 'user', pnl: up },
            { id: 'bot', pnl: bp },
            { id: 'jo', pnl: jp }
        ];
        arr.sort((a, b) => b.pnl - a.pnl);
        return arr.map(x => x.id);
    }

    let lastRanks = getRanks(0, 0, 0);

    for (let idx = 0; idx < sortedTimeline.length; idx++) {
        const item = sortedTimeline[idx];

        if (item.actor === 'user') userPnl += item.pnl;
        else if (item.actor === 'bot') botPnl += item.pnl;
        else if (item.actor === 'jo') joPnl += item.pnl;

        const currentRanks = getRanks(userPnl, botPnl, joPnl);
        if (currentRanks[0] !== lastRanks[0]) {
            const leaderName = currentRanks[0] === 'user' ? 'YOU' : (currentRanks[0] === 'bot' ? 'CH BOT' : 'JO BOT');
            const loserName = lastRanks[0] === 'user' ? 'YOU' : (lastRanks[0] === 'bot' ? 'CH BOT' : 'JO BOT');
            systemEvents.push({
                time: item.time + 1,
                actor: 'system',
                type: 'pass',
                text: `👑 RANK PASS: ${leaderName} closed a trade in profit and passed ${loserName} for 1st place!`
            });
        }
        lastRanks = currentRanks;

        for (let j = 0; j < idx; j++) {
            const prev = sortedTimeline[j];
            if (Math.abs(item.time - prev.time) < 14400 && item.actor !== prev.actor) {
                const pairKey = `notified_${prev.actor}_${item.actor}_${Math.round(prev.time)}_${Math.round(item.time)}`;
                if (!window[pairKey]) {
                    window[pairKey] = true;
                    const name1 = prev.actor === 'user' ? 'YOU' : (prev.actor === 'bot' ? 'CH BOT' : 'JO BOT');
                    const name2 = item.actor === 'user' ? 'YOU' : (item.actor === 'bot' ? 'CH BOT' : 'JO BOT');

                    if (prev.action !== item.action) {
                        systemEvents.push({
                            time: Math.max(prev.time, item.time) + 2,
                            actor: 'system',
                            type: 'duel',
                            text: `⚔️ DUEL: ${name2} entered ${item.action === 'BUY' ? 'LONG' : 'SHORT'} directly opposing ${name1}'s ${prev.action === 'BUY' ? 'LONG' : 'SHORT'} position!`
                        });
                    } else {
                        systemEvents.push({
                            time: Math.max(prev.time, item.time) + 2,
                            actor: 'system',
                            type: 'sync',
                            text: `🔥 SYNC: ${name2} and ${name1} entered in perfect alignment, both going ${item.action === 'BUY' ? 'LONG' : 'SHORT'} together!`
                        });
                    }
                }
            }
        }
    }

    // Merge system events back into primary feed array
    systemEvents.forEach(evt => feed.push(evt));

    // Sort feed descending (newest first) for UI display
    feed.sort((a, b) => b.time - a.time);

    const feedEl = document.getElementById('battle-feed');
    if (!feedEl) return;

    if (!feed.length) {
        feedEl.innerHTML = '<div class="evb-feed-empty">Waiting for trades…</div>';
        return;
    }

    feedEl.innerHTML = feed.slice(0, 25).map(row => {
        if (row.actor === 'system') {
            const badgeLabel = row.type === 'duel' ? 'DUEL' : (row.type === 'sync' ? 'SYNC' : 'LEADER');
            return `
                <div class="evb-feed-row ${row.type}">
                    <div class="evb-feed-system-content">
                        <span class="evb-feed-system-badge">${badgeLabel}</span>
                        <span class="evb-feed-system-text">${row.text}</span>
                    </div>
                </div>
            `;
        }

        const d = new Date(row.time * 1000);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2,'0');
        const mm = String(d.getMinutes()).padStart(2,'0');
        const pnlSign = row.pnl >= 0;

        const rightColumn = row.isOpen
            ? `<span style="background: #FFD600; color: #000; padding: 0.15rem 0.5rem; font-size: 0.6rem; font-weight: 800; font-family: var(--font-mono); border-radius: 2px;">IN TRADE</span>`
            : `<div class="evb-feed-pnl ${pnlSign ? 'pos' : 'neg'}">${row.pnl >= 0 ? '+' : ''}$${Math.abs(row.pnl).toFixed(2)}</div>`;

        const actorName = row.actor === 'bot' ? 'CH BOT' : (row.actor === 'jo' ? 'JO BOT' : 'YOU');

        return `
            <div class="evb-feed-row">
                <div class="evb-feed-time">${day}.${month} ${hh}:${mm}</div>
                <div class="evb-feed-actor ${row.actor}">${actorName}</div>
                <div class="evb-feed-info">
                    <div class="evb-feed-action ${row.action.toLowerCase()}">
                        ${row.action === 'BUY' ? '▲' : '▼'} ${row.action}
                    </div>
                </div>
                ${rightColumn}
            </div>
        `;
    }).join('');
}

async function updateUserStats() {
    const [history, current] = await Promise.all([
        API.getExpertHistory(200),
        API.getExpertCurrent()
    ]);

    if (!history?.length) {
        ['stat-total-pnl','stat-winrate','stat-trades','stat-best','stat-worst','stat-hold']
            .forEach(id => setEl(id, '—'));
        return;
    }

    const pnls = history.map(h => h.pnl || 0);
    const total = pnls.reduce((s, v) => s + v, 0) + (current?.pnl || 0);
    const wins  = pnls.filter(p => p > 0).length;
    const wr    = Math.round(wins / history.length * 100);
    const best  = Math.max(...pnls);
    const worst = Math.min(...pnls);

    // Avg hold time
    let avgHold = '—';
    const durations = history
        .filter(h => h.open_time && h.close_time)
        .map(h => (h.close_time - h.open_time));
    if (durations.length) {
        const avgSec = durations.reduce((s, v) => s + v, 0) / durations.length;
        const hh = Math.floor(avgSec / 3600);
        const mm = Math.floor((avgSec % 3600) / 60);
        avgHold = hh > 0 ? `${hh}h ${mm}m` : `${mm}m`;
    }

    setEl('stat-total-pnl', formatPnl(total), total);
    setEl('stat-winrate', wr + '%');
    setEl('stat-trades', history.length.toString());
    setEl('stat-best', '+$' + best.toFixed(2));
    setEl('stat-worst', '$' + worst.toFixed(2));
    setEl('stat-hold', avgHold);

    const balEl = document.getElementById('balance-display');
    if (balEl) {
        balEl.textContent = '$' + Math.max(0, 100 + total).toFixed(2);
    }

    const depLabelEl = document.getElementById('deposit-label');
    if (depLabelEl) {
        const isRu = window.appLang === 'ru';
        depLabelEl.textContent = isRu ? "Депозит:" : "Deposit:";
    }
}

function updateXP(totalPnl) {
    // No-op: levels and XP system are removed in favor of weekly rating cycles
}

// ── HELPERS ────────────────────────────────────────────
function formatPnl(val) {
    const abs = Math.abs(val).toFixed(2);
    return (val >= 0 ? '+$' : '-$') + abs;
}

function setEl(id, text, pnlVal) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    if (pnlVal !== undefined) {
        el.style.color = pnlVal >= 0 ? '#00C853' : '#FF1744';
    }
}

function drawSparkline(canvas, history, isPositive) {
    if (!canvas || !history || history.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Support High-DPI screen scaling
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    // Determine min and max values to scale
    let min = Math.min(...history);
    let max = Math.max(...history);
    
    // Add margin padding so sparkline doesn't clip
    const pad = 3;
    if (max === min) {
        min -= 10;
        max += 10;
    }
    
    const range = max - min;

    // 1. Draw area gradient underneath the sparkline
    ctx.beginPath();
    history.forEach((val, i) => {
        const x = (i / (history.length - 1)) * (width - 2 * pad) + pad;
        const y = height - ((val - min) / range) * (height - 2 * pad) - pad;
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });
    ctx.lineTo(width - pad, height);
    ctx.lineTo(pad, height);
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, 0, 0, height);
    if (isPositive) {
        grad.addColorStop(0, 'rgba(0, 200, 83, 0.15)');
        grad.addColorStop(1, 'rgba(0, 200, 83, 0.0)');
    } else {
        grad.addColorStop(0, 'rgba(255, 23, 68, 0.15)');
        grad.addColorStop(1, 'rgba(255, 23, 68, 0.0)');
    }
    ctx.fillStyle = grad;
    ctx.fill();

    // 2. Draw stroke line on top
    ctx.beginPath();
    history.forEach((val, i) => {
        const x = (i / (history.length - 1)) * (width - 2 * pad) + pad;
        const y = height - ((val - min) / range) * (height - 2 * pad) - pad;
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });

    const lineColor = isPositive ? '#00C853' : '#FF1744';
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1.75;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
}

async function updateLeaderboard() {
    const res = await API.getLeaderboard().catch(() => null);
    if (!res) return;

    const battleTitleEl = document.getElementById('battle-title');
    const isRu = window.appLang === 'ru';
    if (battleTitleEl) {
        battleTitleEl.textContent = isRu 
            ? "БИТВА ЭКСПЕРТОВ: BTC / USDT (ОБЩИЙ РЕЙТИНГ И РЕЗУЛЬТАТЫ ЗА ВСЕ ВРЕМЯ)" 
            : "EXPERT BATTLE: BTC / USDT (ALL-TIME RATINGS & PERFORMANCE)";
    }

    // 1. Localize table headers dynamically based on language
    const headerEl = document.getElementById('leaderboard-header');
    if (headerEl) {
        headerEl.innerHTML = isRu ? `
            <th style="width: 70px;">#</th>
            <th style="width: 30%;">УЧАСТНИК</th>
            <th style="width: 15%;">ДЕПОЗИТ</th>
            <th style="width: 20%; text-align: center;">ДИНАМИКА</th>
            <th style="width: 15%;">ВИНРЕЙТ</th>
            <th style="width: 20%;">PNL ЗА ВСЕ ВРЕМЯ</th>
        ` : `
            <th style="width: 70px;">#</th>
            <th style="width: 30%;">PARTICIPANT</th>
            <th style="width: 15%;">DEPOSIT</th>
            <th style="width: 20%; text-align: center;">EQUITY TREND</th>
            <th style="width: 15%;">WIN RATE</th>
            <th style="width: 20%;">TOTAL PNL</th>
        `;
    }

    // 2. Render Leaderboard Body
    const bodyEl = document.getElementById('leaderboard-body');
    if (!bodyEl) return;

    if (!res.leaderboard?.length) {
        bodyEl.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px; color: #888;">No ranking data yet…</td></tr>';
        return;
    }

    bodyEl.innerHTML = res.leaderboard.map(item => {
        let rankClass = '';
        if (item.rank === 1) rankClass = 'gold';
        else if (item.rank === 2) rankClass = 'silver';
        else if (item.rank === 3) rankClass = 'bronze';

        const isYou = item.is_you;
        const isBot = item.is_bot;
        
        let displayName = item.name;
        let avatarHtml = '';

        if (displayName === 'Jo Bot' || displayName.includes('Jo Bot')) {
            displayName = 'Jo Bot';
            avatarHtml = `<img src="/jo_bot.jpg" class="evb-avatar" alt="Jo Bot" />`;
        } else if (displayName === 'CRYPTOHEIM BOT' || displayName.includes('CRYPTOHEIM')) {
            displayName = 'CH Bot';
            avatarHtml = `<img src="/ch_bot.jpg" class="evb-avatar" alt="CH Bot" />`;
        } else {
            const initial = displayName ? displayName.charAt(0).toUpperCase() : '?';
            const bg = isYou ? '#2962FF' : '#eee';
            const color = isYou ? '#fff' : '#666';
            const border = isYou ? '2px solid #000' : '2px solid #ccc';
            avatarHtml = `<div class="evb-avatar" style="display: inline-flex; align-items: center; justify-content: center; background: ${bg}; color: ${color}; font-size: 11px; font-weight: 800; font-family: var(--font-mono); border: ${border};">${initial}</div>`;
        }

        const rowClass = isYou ? 'evb-hero-row you' : 'evb-hero-row';
        const pnlSign = item.total_pnl >= 0;
        const formattedPnl = (item.total_pnl >= 0 ? '+' : '') + '$' + item.total_pnl.toFixed(2);
        const pnlClass = pnlSign ? 'pos' : 'neg';

        const formattedBalance = '$' + (item.equity || 100.0).toFixed(2);
        const formattedWinRate = item.win_rate != null ? item.win_rate.toFixed(0) + '%' : '0%';

        const pts = item.points || 0;
        const pointsBadge = `<span class="evb-points-badge">${pts} PTS</span>`;

        const historyData = item.equity_history || [100.0];

        return `
            <tr class="${rowClass}">
                <td class="td-rank">
                    <span class="evb-lb-rank ${rankClass}">${item.rank}</span>
                </td>
                <td class="td-actor">
                    <span class="evb-actor-label">${avatarHtml}<span>${displayName}</span></span>
                    ${pointsBadge}
                    ${isYou ? '<span class="evb-lb-you-tag" style="margin-left: 8px; background: #2962FF; color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 10px;">YOU</span>' : ''}
                </td>
                <td class="td-val" style="font-weight: 600;">${formattedBalance}</td>
                <td style="text-align: center; vertical-align: middle; padding: 4px 8px;">
                    <canvas class="evb-sparkline" data-history='${JSON.stringify(historyData)}' width="120" height="30" style="width: 120px; height: 30px; display: inline-block; vertical-align: middle;"></canvas>
                </td>
                <td class="td-val">${formattedWinRate}</td>
                <td class="td-pnl ${pnlClass}" style="color: ${pnlSign ? '#00C853' : '#FF1744'}; font-weight: bold;">
                    ${formattedPnl}
                </td>
            </tr>
        `;
    }).join('');


    // 3. Render Sparklines in-line
    document.querySelectorAll('.evb-sparkline').forEach(canvas => {
        try {
            const history = JSON.parse(canvas.dataset.history || '[100.0]');
            const isPositive = parseFloat(history[history.length - 1] || 100.0) >= 100.0;
            drawSparkline(canvas, history, isPositive);
        } catch(e) {
            console.error("drawSparkline failed:", e);
        }
    });
}

