import { API } from './api.js';

const REFRESH_INTERVAL_SEC = 300; // 5 minutes
let timeRemaining = REFRESH_INTERVAL_SEC;

document.addEventListener('DOMContentLoaded', () => {
    window.appLang = localStorage.getItem('appLang') || 'en';
    
    const langBtns = document.querySelectorAll('.lang-btn');
    if (langBtns.length > 0) {
        langBtns.forEach(btn => {
            if (btn.dataset.lang === window.appLang) btn.classList.add('active');
            else btn.classList.remove('active');
            
            btn.addEventListener('click', () => {
                if (btn.dataset.lang === window.appLang) return;
                langBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                window.appLang = btn.dataset.lang;
                localStorage.setItem('appLang', window.appLang);
                updateDashboardData(); // Refresh all
            });
        });
    }

    startDashboard();
});

async function startDashboard() {
    await updateDashboardData();
    startRefreshTimer();
}

async function updateDashboardData() {
    await Promise.allSettled([
        renderDecisionStrip(),
        renderTopSignals(),
        renderNarrativeEngine(),
        renderLatestNews(),
        renderExposureAndPositions()
    ]);
}

function startRefreshTimer() {
    const timerText = document.getElementById('refresh-timer');
    if (!timerText) return;
    setInterval(() => {
        timeRemaining--;
        if (timeRemaining <= 0) {
            timeRemaining = REFRESH_INTERVAL_SEC;
            updateDashboardData();
        }
        const minutes = Math.floor(timeRemaining / 60);
        const seconds = timeRemaining % 60;
        timerText.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
}

// ----------------------------------------------------
// DECISION STRIP
// ----------------------------------------------------
async function renderDecisionStrip() {
    try {
        const lang = window.appLang || 'en';
        
        // Parallel fetch required data
        const [analysis, fngIndex, marketScan, domStream] = await Promise.allSettled([
            API.getCryptoAnalysis(lang),
            API.getFearGreedIndex(),
            API.getMarketScan(),
            API.getDominanceStreamgraph()
        ]);

        if (analysis.status === "fulfilled" && analysis.value) {
            const data = analysis.value;
            const headline = data.widget_long?.headline || "NEUTRAL";
            document.getElementById('ds-bias').innerText = headline;
            
            // Bias color
            const directionBlock = document.getElementById('ds-direction-block');
            document.getElementById('ds-direction-block').querySelector('.label').innerText = `BIAS: ${headline}`;
            
            directionBlock.style.background = ''; // reset inline background color
            const headlineLower = headline.toLowerCase();

            if (headlineLower.includes('bull') || headlineLower.includes('быч')) {
                directionBlock.className = 'decision-block primary-bias-block';
                document.getElementById('ds-bias').className = 'value text-green';
            } else if (headlineLower.includes('bear') || headlineLower.includes('медв')) {
                directionBlock.className = 'decision-block primary-bias-block bear';
                document.getElementById('ds-bias').className = 'value text-red';
            } else {
                directionBlock.className = 'decision-block primary-bias-block neutral';
                document.getElementById('ds-bias').className = 'value';
            }

            const conf = data.widget_long?.confidence_pct || 50;
            document.getElementById('ds-confidence').innerText = `${conf}%`;
            document.getElementById('ds-confidence-fill').style.width = `${conf}%`;
        }

        if (fngIndex.status === "fulfilled" && fngIndex.value) {
            document.getElementById('ds-fng-val').innerText = fngIndex.value.current_value;
            document.getElementById('ds-fng-label').innerText = fngIndex.value.current_classification;
        }

        if (marketScan.status === "fulfilled" && marketScan.value) {
            const mood = marketScan.value.breadth?.mood || "SIDEWAYS";
            document.getElementById('ds-trend').innerText = mood;
        }

        if (domStream.status === "fulfilled" && domStream.value) {
            const data = domStream.value.data || [];
            if (data.length > 0) {
                const latest = data[data.length - 1];
                document.getElementById('ds-btc-dom').innerText = `${latest.btc_dominance.toFixed(1)}%`;
            }
            const marketCapChange = domStream.value.market_cap_24h_change;
            if (marketCapChange !== undefined) {
                const volString = Math.abs(marketCapChange) > 3 ? "HIGH VOLATILITY" : "LOW VOLATILITY";
                document.getElementById('ds-volatility').innerText = volString;
                document.getElementById('ds-volatility').style.color = Math.abs(marketCapChange) > 3 ? "var(--color-red)" : "var(--text-muted)";
            }
        }

    } catch (e) {
        console.error("Decision Strip error:", e);
    }
}

// ----------------------------------------------------
// TOP SIGNALS
// ----------------------------------------------------
const cleanSymbol = (sym) => String(sym).replace('USDT', '');

async function renderTopSignals() {
    const list = document.getElementById('signals-list');
    if (!list) return;

    try {
        const [forecastRes, klinesRes] = await Promise.allSettled([
            API.getMarketForecast(window.appLang || 'en'),
            API.getSparklines() // or klines summary
        ]);

        if (forecastRes.status === "fulfilled" && forecastRes.value?.forecast?.top_signals) {
            const signals = forecastRes.value.forecast.top_signals.slice(0, 4); // Max 4
            let htmlChunks = [];
            
            // Get prices block
            let prices = {};
            if (klinesRes.status === "fulfilled" && klinesRes.value) {
                // sparklines usually dictionary of symbol -> array
                for (const symbol in klinesRes.value) {
                    const arr = klinesRes.value[symbol];
                    if (arr && arr.length > 0) {
                        prices[symbol] = arr[arr.length - 1];
                    }
                }
            }

            signals.forEach((s, i) => {
                const sStr = String(s.signal).toLowerCase();
                let badgeClass = 'badge-yellow';
                if(sStr.includes('buy')) badgeClass = 'badge-green';
                if(sStr.includes('sell')) badgeClass = 'badge-red';

                const symUp = String(s.symbol).toUpperCase();
                const matchSym = symUp.endsWith('USDT') ? symUp : symUp + 'USDT';
                const price = prices[matchSym] || prices[symUp] || '--';
                const fPrice = (typeof price === 'number') ? (price < 1 ? price.toFixed(4) : price.toFixed(2)) : price;

                // Hacky risk eval
                const riskLevel = sStr.includes('strong') ? 'MEDIUM' : (sStr.includes('sell') ? 'HIGH' : 'LOW');
                
                htmlChunks.push(`
                    <div class="signal-row">
                        <div class="signal-rank">${i + 1}</div>
                        <div class="signal-main">
                            <div class="signal-info">
                                <h3>${cleanSymbol(s.symbol)}</h3>
                                <div class="signal-badge ${badgeClass}">${s.signal}</div>
                                <div class="signal-desc"><b>Why:</b> ${s.reason}</div>
                            </div>
                        </div>
                        <div class="signal-price-col">
                            PRICE
                            <div class="signal-price">$${fPrice}</div>
                            <div class="signal-risk">RISK: ${riskLevel}</div>
                        </div>
                        <div class="signal-chart-col">
                            <canvas id="top-sig-chart-${i}"></canvas>
                        </div>
                    </div>
                `);
            });

            list.innerHTML = htmlChunks.join('');

            // Draw charts
            if (klinesRes.status === "fulfilled" && klinesRes.value) {
                signals.forEach((s, i) => {
                    const sparklineData = klinesRes.value[s.symbol];
                    if (sparklineData && sparklineData.length > 0) {
                        drawBrutalSparkline(`top-sig-chart-${i}`, sparklineData);
                    }
                });
            }
        } else {
            list.innerHTML = '<p>No signals generated yet.</p>';
        }
    } catch(e) {
        console.error("Top signals error:", e);
    }
}

// ----------------------------------------------------
// NARRATIVE ENGINE
// ----------------------------------------------------
async function renderNarrativeEngine() {
    try {
        const lang = window.appLang || 'en';
        const forecastRes = await API.getMarketForecast(lang);

        if (forecastRes && forecastRes.forecast) {
            const summaryEl = document.getElementById('narrative-summary');
            if (summaryEl) {
                summaryEl.innerHTML = forecastRes.forecast.forecast || forecastRes.forecast.market_state;
            }
        }
    } catch(e) { console.error(e); }
}

// ----------------------------------------------------
// LATEST NEWS
// ----------------------------------------------------
async function renderLatestNews() {
    const content = document.getElementById('news-content');
    const timeEl = document.getElementById('news-time');
    if (!content) return;

    try {
        const lang = window.appLang || 'en';
        const news = await API.getLatestNews(lang);

        if (news && news.summary) {
            // Format timestamp
            const date = new Date(news.timestamp || new Date());
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            if (timeEl) timeEl.innerText = `${hours}:${minutes}`;

            // Handle line breaks
            const formattedText = news.summary.replace(/\n/g, '<br/>');
            content.innerHTML = formattedText;
            
            // Add sources if available
            if (news.sources && news.sources.length > 0) {
                const srcHtml = news.sources.map(s => {
                    let title = s.title;
                    if (!title && s.url) {
                        try { title = (new URL(s.url)).hostname; } catch(err) { title = 'Link'; }
                    }
                    return `<a href="${s.url}" target="_blank" style="text-decoration: underline; margin-right: 10px;">${title}</a>`;
                }).join('');
                content.innerHTML += `<div style="margin-top: 1rem; padding-top: 0.5rem; border-top: var(--border-thin); font-size: 0.75rem;">SOURCES: ${srcHtml}</div>`;
            }
        } else {
            content.innerHTML = 'No recent intelligence found.';
            if (timeEl) timeEl.innerText = '--:--';
        }
    } catch(e) {
        console.error(e);
        content.innerHTML = 'Error loading intelligence.';
        if (timeEl) timeEl.innerText = 'ERROR';
    }
}

// ----------------------------------------------------
// EXPOSURE & POSITIONS
// ----------------------------------------------------
async function renderExposureAndPositions() {
    try {
        const [stats, positions, sparklinesObj] = await Promise.all([
            API.getBotStats().catch(()=>null),
            API.getBotPositions().catch(()=>[]),
            API.getSparklines().catch(()=>null)
        ]);

        let unrealizedPnl = 0;

        // Positions Table
        const tbody = document.getElementById('pos-table-body');
        if (!positions || positions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No Active Positions</td></tr>';
            document.getElementById('exp-net-bias').innerText = 'FLAT 100%';
            document.getElementById('exp-net-bias').className = `exp-value text-muted`;
        } else {
            let html = '';
            let longSize = 0, shortSize = 0;

            for(let i=0; i<positions.length; i++) {
                const pos = positions[i];
                const isLong = pos.side.toLowerCase() === 'buy';
                
                if(isLong) longSize += pos.size;
                else shortSize += pos.size;

                const price = (sparklinesObj && sparklinesObj[pos.symbol]) ? sparklinesObj[pos.symbol][sparklinesObj[pos.symbol].length - 1] : pos.entry_price;
                const pnlValue = isLong ? (price - pos.entry_price)*pos.size : (pos.entry_price - price)*pos.size;
                const pnlClass = pnlValue >= 0 ? 'text-green' : 'text-red';
                
                unrealizedPnl += pnlValue;

                html += `
                    <tr>
                        <td>
                            ${cleanSymbol(pos.symbol)}
                            <div style="font-size: 0.7rem; font-weight: 800; color: var(--color-${isLong ? 'green' : 'red'});">${isLong ? 'LONG' : 'SHORT'}</div>
                        </td>
                        <td>${pos.size.toFixed(3)}</td>
                        <td>$${pos.entry_price.toFixed(2)}</td>
                        <td>$${price.toFixed(2)}</td>
                        <td class="${pnlClass}">${pnlValue > 0 ? '+' : ''}${pnlValue.toFixed(2)}</td>
                        <td class="td-chart"><canvas id="pos-chart-${pos.id}"></canvas></td>
                        <td class="td-sltp">
                            <span class="text-red">SL $${pos.sl_price.toFixed(2)}</span><br/>
                            <span class="text-green">TP $${pos.tp_price.toFixed(2)}</span>
                        </td>
                    </tr>
                `;
            }
            tbody.innerHTML = html;

            // Net Bias Tracker
            const total = longSize + shortSize;
            if(total > 0) {
                const lPct = (longSize / total) * 100;
                document.getElementById('exp-net-bias').innerText = `${lPct >= 50 ? 'LONG' : 'SHORT'} ${Math.max(lPct, 100-lPct).toFixed(0)}%`;
                document.getElementById('exp-net-bias').className = `exp-value ${lPct >= 50 ? 'text-green' : 'text-red'}`;
            }

            positions.forEach(pos => {
                const sparklineData = sparklinesObj && sparklinesObj[pos.symbol] ? sparklinesObj[pos.symbol] : null;
                if(sparklineData) drawBrutalSparkline(`pos-chart-${pos.id}`, sparklineData, pos.side.toLowerCase() === 'buy', {
                    entry: pos.entry_price,
                    sl: pos.sl_price,
                    tp: pos.tp_price
                });
            });

            // Allocation calculation
            const equity = stats ? (stats.balance_history[stats.balance_history.length - 1]?.equity || 100) : 100;
            let currentAssetVal = 0;
            let allocHtml = '';
            
            // Just for demonstration logic based on Positions
            let btcVal = 0, ethVal = 0, altsVal = 0;
            positions.forEach(pos => {
                const price = (sparklinesObj && sparklinesObj[pos.symbol]) ? sparklinesObj[pos.symbol][sparklinesObj[pos.symbol].length - 1] : pos.entry_price;
                const val = pos.size * price;
                currentAssetVal += val;
                
                if(pos.symbol.includes('BTC')) btcVal += val;
                else if(pos.symbol.includes('ETH')) ethVal += val;
                else altsVal += val;
            });
            
            const cashVal = Math.max(0, equity - currentAssetVal);
            const sumVal = btcVal + ethVal + altsVal + cashVal;

            if (sumVal > 0) {
                const bPct = (btcVal / sumVal) * 100;
                const ePct = (ethVal / sumVal) * 100;
                const aPct = (altsVal / sumVal) * 100;
                const cPct = (cashVal / sumVal) * 100;

                if (bPct > 0) allocHtml += `<div style="width:${bPct}%; background:var(--color-yellow); color:#000; display:flex; align-items:center; justify-content:center; border-right: var(--border-thin);">BTC ${bPct.toFixed(0)}%</div>`;
                if (ePct > 0) allocHtml += `<div style="width:${ePct}%; background:var(--color-blue); display:flex; align-items:center; justify-content:center; border-right: var(--border-thin);">ETH ${ePct.toFixed(0)}%</div>`;
                if (aPct > 0) allocHtml += `<div style="width:${aPct}%; background:var(--text-main); display:flex; align-items:center; justify-content:center; border-right: var(--border-thin);">ALTS ${aPct.toFixed(0)}%</div>`;
                if (cPct > 0) allocHtml += `<div style="width:${cPct}%; background:var(--color-green); color:#000; display:flex; align-items:center; justify-content:center;">CASH ${cPct.toFixed(0)}%</div>`;
            } else {
                allocHtml = `<div style="width:100%; background:var(--color-green); color:#000; display:flex; align-items:center; justify-content:center;">CASH 100%</div>`;
            }

            document.getElementById('allocation-bar').innerHTML = allocHtml;
        }

        // Stats Box
        if (stats) {
            const totalPnl = (stats.total_pnl_usdt || 0) + unrealizedPnl;
            document.getElementById('exp-pnl').innerText = `$${totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}`;
            document.getElementById('exp-pnl').className = `exp-value ${totalPnl >= 0 ? 'text-green' : 'text-red'}`;
            
            const exposure = stats.total_exposure_usdt || 0;
            document.getElementById('exp-exposure').innerText = `$${exposure.toFixed(2)}`;

            // Extended Stats
            document.getElementById('exp-winrate').innerText = `${(stats.win_rate_pct || 0).toFixed(1)}%`;
            document.getElementById('exp-trades').innerText = stats.total_closed_trades || 0;
            document.getElementById('exp-accuracy').innerText = `${(stats.ai_accuracy_pct || 0).toFixed(1)}%`;

            const hist = stats.balance_history;
            if(hist && hist.length > 0) {
                const liveEquity = hist[hist.length - 1].equity + unrealizedPnl;
                document.getElementById('exp-equity').innerText = `$${liveEquity.toFixed(2)}`;
                document.getElementById('exp-equity').className = `exp-value`;
            }
        }

        // Risks
        const forecastRes = await API.getMarketForecast(window.appLang || 'en');
        if(forecastRes && forecastRes.forecast && forecastRes.forecast.risks) {
            const risksHtml = forecastRes.forecast.risks.replace(/\n/g, '<br/>');
            const el = document.getElementById('risk-list');
            if (el) el.innerHTML = risksHtml;
        }

    } catch(e) { console.error(e); }
}

// ----------------------------------------------------
// UTILS
// ----------------------------------------------------
function drawBrutalSparkline(canvasId, dataPoints, isUp = true, levels = null) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const color = isUp ? '#000' : '#FF1744';

    const datasets = [{
        data: dataPoints,
        borderColor: color,
        borderWidth: 2,
        tension: 0,
        pointRadius: 0,
        pointHoverRadius: 0,
        fill: false,
        stepped: false
    }];

    if (levels) {
        const len = dataPoints.length;
        if (levels.entry) {
            datasets.push({ data: Array(len).fill(levels.entry), borderColor: '#888', borderWidth: 1, borderDash: [2,2], pointRadius: 0 });
        }
        if (levels.sl) {
            datasets.push({ data: Array(len).fill(levels.sl), borderColor: '#FF1744', borderWidth: 1, borderDash: [2,2], pointRadius: 0 });
        }
        if (levels.tp) {
            datasets.push({ data: Array(len).fill(levels.tp), borderColor: '#00E676', borderWidth: 1, borderDash: [2,2], pointRadius: 0 });
        }
    }

    // Adjust Y-axis scale to include levels if they exist, but clip extreme values so sparkline doesn't flatline
    let minVal = Math.min(...dataPoints);
    let maxVal = Math.max(...dataPoints);
    
    if (levels) {
        // Only include levels in scale if they are within 10% of the price action, otherwise clip them out of view
        const range = maxVal - minVal;
        const permittedSpread = range * 0.5 || minVal * 0.05;
        const boundedMin = minVal - permittedSpread;
        const boundedMax = maxVal + permittedSpread;
        
        if (levels.sl && levels.sl > boundedMin && levels.sl < boundedMax) {
            minVal = Math.min(minVal, levels.sl);
            maxVal = Math.max(maxVal, levels.sl);
        }
        if (levels.tp && levels.tp > boundedMin && levels.tp < boundedMax) {
            minVal = Math.min(minVal, levels.tp);
            maxVal = Math.max(maxVal, levels.tp);
        }
    }

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: dataPoints.map((_, i) => i),
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            scales: {
                x: { display: false },
                y: { display: false, min: minVal * 0.999, max: maxVal * 1.001 }
            },
            layout: { padding: 5 },
            animation: false
        }
    });
}
