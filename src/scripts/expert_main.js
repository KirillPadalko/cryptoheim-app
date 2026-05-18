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

function isLoggedIn() {
    const token = localStorage.getItem('cryptoheim_token');
    const userJson = localStorage.getItem('cryptoheim_user');
    return !!(token && userJson);
}

function isPro() {
    if (!isLoggedIn()) return false;
    try {
        const user = JSON.parse(localStorage.getItem('cryptoheim_user'));
        return user.is_pro === true;
    } catch(e) { return false; }
}


document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOMContentLoaded: Starting initialization");
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
    }

    // Draw markers
    await renderChartMarkers();

    // Draw active forecast lines
    const current = await API.getExpertCurrent();
    if (current) {
        if (current.tp_price) candleSeries.createPriceLine({
            price: current.tp_price, color: '#00C853', lineWidth: 2,
            lineStyle: LightweightCharts.LineStyle.Dashed, axisLabelVisible: true, title: 'TP'
        });
        if (current.sl_price) candleSeries.createPriceLine({
            price: current.sl_price, color: '#FF1744', lineWidth: 2,
            lineStyle: LightweightCharts.LineStyle.Dashed, axisLabelVisible: true, title: 'SL'
        });
        candleSeries.createPriceLine({
            price: current.entry_price, color: '#2962FF', lineWidth: 1,
            lineStyle: LightweightCharts.LineStyle.Solid, axisLabelVisible: true, title: 'ENTRY'
        });
    }
}

async function renderChartMarkers() {
    const [expHistory, botHistory] = await Promise.all([
        API.getExpertHistory(100),
        API.getBotHistory(200)
    ]);
    
    const markers = [];
    
    (expHistory || []).forEach(h => {
        if (h.open_time) {
            const timeOpen = h.open_time > 1e12 ? Math.floor(h.open_time / 1000) : h.open_time;
            markers.push({
                time: timeOpen,
                position: h.side === 'BUY' ? 'belowBar' : 'aboveBar',
                color: '#2962FF',
                shape: h.side === 'BUY' ? 'arrowUp' : 'arrowDown',
                text: 'YOU IN',
                size: 2
            });
        }
        if (h.close_time) {
            const timeClose = h.close_time > 1e12 ? Math.floor(h.close_time / 1000) : h.close_time;
            markers.push({
                time: timeClose,
                position: h.side === 'BUY' ? 'aboveBar' : 'belowBar',
                color: '#2962FF',
                shape: h.side === 'BUY' ? 'arrowDown' : 'arrowUp',
                text: 'YOU OUT',
                size: 2
            });
        }
    });

    (botHistory || []).filter(t => t.symbol === 'BTCUSDT').forEach(t => {
        const side = ['BUY','LONG'].includes(String(t.side).toUpperCase()) ? 'BUY' : 'SELL';
        if (t.open_time) {
            const timeOpen = typeof t.open_time === 'number'
                ? (t.open_time > 1e12 ? Math.floor(t.open_time / 1000) : t.open_time)
                : Math.floor(new Date(t.open_time).getTime() / 1000);
            markers.push({
                time: timeOpen,
                position: side === 'BUY' ? 'belowBar' : 'aboveBar',
                color: '#000',
                shape: 'square',
                text: 'BOT IN',
                size: 1
            });
        }
        if (t.close_time) {
            const timeClose = typeof t.close_time === 'number'
                ? (t.close_time > 1e12 ? Math.floor(t.close_time / 1000) : t.close_time)
                : Math.floor(new Date(t.close_time).getTime() / 1000);
                
            markers.push({
                time: timeClose,
                position: side === 'BUY' ? 'aboveBar' : 'belowBar',
                color: '#000',
                shape: 'circle',
                text: 'BOT OUT',
                size: 1
            });
        }
    });

    console.log(`[Chart] Generated ${markers.length} markers`);
    candleSeries.setMarkers(markers.sort((a,b) => a.time - b.time));
    
    if (markers.length > 0) console.log(`[Chart] First marker time: ${markers[0].time}`);
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
    if (prev) {
        const pct = ((last.close - prev.close) / prev.close * 100).toFixed(2);
        const pos = pct >= 0;
        changeEl.textContent = (pos ? '+' : '') + pct + '%';
        changeEl.className = 'evb-price-change ' + (pos ? 'pos' : 'neg');
    }
    updateTPSLPcts();
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
        const size = parseFloat(sizeInput.value) || 10;
        const tp   = parseFloat(tpInput.value) || null;
        const sl   = parseFloat(slInput.value) || null;
        const res  = await API.submitExpertForecast(selectedSide, '', tp, sl, size);
        if (res?.status === 'success') {
            resetControls();
            await updateAll();
            await loadChartData();
        } else {
            alert('Failed to place trade. Is one already open?');
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
        updateHero(),
        updateActiveForecast(),
        updateBattleFeed(),
        updateUserStats(),
        updateLeaderboard(),
    ]);
}

async function updateHero() {
    const [stats, expHistory, botHistory] = await Promise.all([
        API.getExpertStats().catch(() => null),
        API.getExpertHistory(200).catch(() => []),
        API.getBotHistory(500).catch(() => [])
    ]);

    const oneWeekAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
    
    function getCloseTs(h) {
        if (!h.close_time) return Date.now();
        return typeof h.close_time === 'number' 
            ? (h.close_time > 1e12 ? h.close_time : h.close_time * 1000) 
            : new Date(h.close_time).getTime();
    }

    // Expert All-Time Equity (for XP calculation)
    let expPnlTotal = 0;
    if (stats?.expert?.equity != null) {
        expPnlTotal = stats.expert.equity - 100;
    } else if (expHistory?.length) {
        expPnlTotal = expHistory.reduce((s, h) => s + (h.pnl || 0), 0);
    }
    updateXP(expPnlTotal);

    // Expert Weekly Stats
    const expWeekly = (expHistory || []).filter(h => getCloseTs(h) >= oneWeekAgoMs);
    const expPnlWeekly = expWeekly.reduce((s, h) => s + (h.pnl || 0), 0);
    const expWinsWeekly = expWeekly.filter(h => (h.pnl || 0) > 0).length;
    const expWRWeekly = expWeekly.length ? Math.round(expWinsWeekly / expWeekly.length * 100) : 0;

    setEl('user-pnl', formatPnl(expPnlWeekly), expPnlWeekly);
    setEl('user-winrate', expWeekly.length ? expWRWeekly + '%' : '—%');

    // Bot Weekly Stats (Only BTCUSDT for the Battle)
    const botWeekly = (botHistory || []).filter(h => h.symbol === 'BTCUSDT' && getCloseTs(h) >= oneWeekAgoMs);
    
    let botPnlWeekly = 0;
    botWeekly.forEach(t => {
        if (t.pnl != null) {
            botPnlWeekly += t.pnl;
        } else if (t.entry_price > 0 && t.close_price) {
            let diff = t.close_price - t.entry_price;
            if (['SELL','SHORT'].includes(String(t.side).toUpperCase())) diff = -diff;
            botPnlWeekly += 100 * (diff / t.entry_price);
        }
    });

    const botWinsWeekly = botWeekly.filter(t => {
        if (t.pnl != null) return t.pnl > 0;
        if (t.entry_price > 0 && t.close_price) {
            let diff = t.close_price - t.entry_price;
            if (['SELL','SHORT'].includes(String(t.side).toUpperCase())) diff = -diff;
            return diff > 0;
        }
        return false;
    }).length;
    
    const botWRWeekly = botWeekly.length ? Math.round(botWinsWeekly / botWeekly.length * 100) : 0;

    setEl('bot-pnl', formatPnl(botPnlWeekly), botPnlWeekly);
    setEl('bot-winrate', botWeekly.length ? botWRWeekly + '%' : '—%');

    // Score bar
    const total = Math.abs(expPnlWeekly) + Math.abs(botPnlWeekly) || 1;
    const botFill = Math.max(5, Math.min(95, Math.abs(botPnlWeekly) / total * 100));
    const userFill = 100 - botFill;
    const fillBot = document.getElementById('score-fill-bot');
    const fillUser = document.getElementById('score-fill-user');
    if (fillBot) fillBot.style.width = botFill + '%';
    if (fillUser) fillUser.style.width = userFill + '%';
}

async function updateActiveForecast() {
    const data = await API.getExpertCurrent();
    const banner = document.getElementById('active-position-banner');
    const card   = document.getElementById('action-card');
    if (!banner || !card) return;

    if (data) {
        const pnl = data.pnl || 0;
        const pos = pnl >= 0;
        banner.style.display = 'block';
        banner.innerHTML = `
            <div class="evb-active-banner">
                <div>
                    <div class="evb-active-banner-label">👤 YOUR ACTIVE POSITION</div>
                    <div class="evb-active-banner-info">
                        ${data.side === 'BUY' ? 'LONG' : 'SHORT'} $${data.size}
                        <span class="evb-leverage-badge">×10</span>
                        @ $${data.entry_price}
                    </div>
                    ${data.tp_price ? `<div style="font-size:0.65rem;color:#00C853;font-family:var(--font-mono);margin-top:0.25rem;">TP: $${data.tp_price}</div>` : ''}
                    ${data.sl_price ? `<div style="font-size:0.65rem;color:#FF1744;font-family:var(--font-mono);">SL: $${data.sl_price}</div>` : ''}
                </div>
                <div style="text-align:right">
                    <div class="evb-active-banner-pnl ${pos ? 'pos' : 'neg'}">${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}</div>
                    <button class="evb-close-btn" id="btn-close-forecast">CLOSE TRADE</button>
                </div>
            </div>
        `;
        card.style.display = 'none';

        document.getElementById('btn-close-forecast')?.addEventListener('click', async () => {
            if (confirm('Close this position?')) {
                await API.closeExpertForecast();
                banner.style.display = 'none';
                card.style.display = 'block';
                await updateAll();
                await loadChartData();
            }
        });

        // Update status badge
        const badge = document.getElementById('user-status-badge');
        if (badge) { badge.textContent = 'IN TRADE'; badge.classList.add('active'); }
    } else {
        banner.style.display = 'none';
        card.style.display = 'block';
        const badge = document.getElementById('user-status-badge');
        if (badge) { badge.textContent = 'READY'; badge.classList.remove('active'); }
    }

    // Bot status
    const botStats = await API.getExpertStats();
    const botPos = botStats?.bot?.current_position;
    const botBadge = document.getElementById('bot-status-badge');
    if (botBadge) {
        if (botPos) { botBadge.textContent = 'IN TRADE'; botBadge.classList.add('active'); }
        else { botBadge.textContent = 'STANDBY'; botBadge.classList.remove('active'); }
    }
}

async function updateBattleFeed() {
    const [expHistory, botHistory] = await Promise.all([
        API.getExpertHistory(10),
        API.getBotHistory(30)
    ]);

    const feed = [];

    (expHistory || []).forEach(h => {
        feed.push({
            time: h.close_time,
            actor: 'user',
            action: h.side === 'BUY' ? 'BUY' : 'SELL',
            pair: 'BTC/USDT',
            pnl: h.pnl || 0,
        });
    });

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
        });
    });

    feed.sort((a, b) => b.time - a.time);

    const feedEl = document.getElementById('battle-feed');
    if (!feedEl) return;

    if (!feed.length) {
        feedEl.innerHTML = '<div class="evb-feed-empty">Waiting for trades…</div>';
        return;
    }

    feedEl.innerHTML = feed.slice(0, 20).map(row => {
        const d = new Date(row.time * 1000);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2,'0');
        const mm = String(d.getMinutes()).padStart(2,'0');
        const pnlSign = row.pnl >= 0;
        return `
            <div class="evb-feed-row">
                <div class="evb-feed-time">${day}.${month} ${hh}:${mm}</div>
                <div class="evb-feed-actor ${row.actor}">${row.actor === 'bot' ? 'CH BOT' : 'YOU'}</div>
                <div class="evb-feed-info">
                    <div class="evb-feed-action ${row.action.toLowerCase()}">
                        ${row.action === 'BUY' ? '▲' : '▼'} ${row.action}
                    </div>
                </div>
                <div class="evb-feed-pnl ${pnlSign ? 'pos' : 'neg'}">
                    ${row.pnl >= 0 ? '+' : ''}$${Math.abs(row.pnl).toFixed(2)}
                </div>
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
}

function updateXP(totalPnl) {
    // Basic XP system: 10 XP per $1 PnL + 500 base XP
    const baseXP = 500;
    const pnlXP = Math.max(0, totalPnl * 10);
    const totalXP = Math.floor(baseXP + pnlXP);
    
    const level = Math.floor(totalXP / 1000) + 1;
    const currentLevelXP = totalXP % 1000;
    
    const lvlEl = document.getElementById('user-level');
    const xpValEl = document.getElementById('user-xp-val');
    const xpFillEl = document.getElementById('user-xp-fill');

    if (lvlEl) lvlEl.textContent = String(level);
    if (xpValEl) xpValEl.textContent = String(currentLevelXP);
    if (xpFillEl) xpFillEl.style.width = (currentLevelXP / 10).toFixed(0) + '%';
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

async function updateLeaderboard() {
    const res = await API.getLeaderboard().catch(() => null);
    if (!res) return;
    
    // 1. Update compact ratings in the Hero scoreboard
    const botRankEl = document.getElementById('bot-global-rank');
    const userRankEl = document.getElementById('user-global-rank');
    
    if (botRankEl) {
        botRankEl.textContent = res.bot_rank ? `#${res.bot_rank}` : '#—';
    }
    
    if (userRankEl) {
        if (isLoggedIn()) {
            userRankEl.textContent = res.user_rank ? `#${res.user_rank}` : '#—';
            userRankEl.style.display = 'inline-block';
        } else {
            userRankEl.style.display = 'none';
        }
    }
    
    // Update "EXPERT" label to show nickname if logged in
    const expertLabelName = document.getElementById('expert-label-name');
    if (expertLabelName) {
        if (isLoggedIn()) {
            try {
                const user = JSON.parse(localStorage.getItem('cryptoheim_user'));
                expertLabelName.textContent = user.boosty_nickname.toUpperCase();
            } catch (e) {
                expertLabelName.textContent = 'YOU';
            }
        } else {
            expertLabelName.textContent = 'GUEST EXPERT';
        }
    }
    
    // 2. Render Leaderboard List
    const lbListEl = document.getElementById('leaderboard-list');
    if (!lbListEl) return;
    
    if (!res.leaderboard?.length) {
        lbListEl.innerHTML = '<div class="evb-feed-empty">No ranking data yet…</div>';
        return;
    }
    
    lbListEl.innerHTML = res.leaderboard.map(item => {
        let rankClass = '';
        if (item.rank === 1) rankClass = 'gold';
        else if (item.rank === 2) rankClass = 'silver';
        else if (item.rank === 3) rankClass = 'bronze';
        
        const isYou = item.is_you;
        const isBot = item.is_bot;
        const displayName = isBot ? 'CRYPTOHEIM BOT 🤖' : item.name;
        
        const rowClass = isYou ? 'evb-lb-row you' : 'evb-lb-row';
        const pnlSign = item.total_pnl >= 0;
        const formattedPnl = (item.total_pnl >= 0 ? '+' : '') + '$' + item.total_pnl.toFixed(2);
        const pnlClass = pnlSign ? 'evb-lb-pnl pos' : 'evb-lb-pnl neg';
        
        return `
            <div class="${rowClass}">
                <div class="evb-lb-rank ${rankClass}">${item.rank}</div>
                <div class="evb-lb-name">
                    ${displayName}
                    ${isYou ? '<span class="evb-lb-you-tag">YOU</span>' : ''}
                </div>
                <div class="${pnlClass}">${formattedPnl}</div>
            </div>
        `;
    }).join('');
}
