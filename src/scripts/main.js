import { API } from './api.js';

const REFRESH_INTERVAL_SEC = 300; // 5 minutes
let timeRemaining = REFRESH_INTERVAL_SEC;

const I18N = {
    'ru': {
        'subtitle': 'ДЭШБОРД АНАЛИТИКИ И СИГНАЛОВ',
        'app_btn': 'ПРИЛОЖЕНИЕ В GOOGLE PLAY',
        'live': 'ОНЛАЙН',
        'next_upd': 'СЛЕДУЮЩЕЕ ОБНОВЛЕНИЕ',
        'mkt_bias': 'ОЦЕНКА РЫНКА',
        'short_outlook': 'КРАТКОСРОЧНЫЙ ПРОГНОЗ',
        'confidence': 'УВЕРЕННОСТЬ',
        'fng': 'СТРАХ И ЖАДНОСТЬ',
        'trend': 'ТРЕНД',
        'reversal': 'ВЕРОЯТНОСТЬ РАЗВОРОТА',
        'btc_dom': 'ДОМИНАЦИЯ BTC',
        'bias': 'ПРОГНОЗ',
        'waiting': 'ожидание сигнала',
        'top_signals': 'ГЛАВНЫЕ СИГНАЛЫ',
        'priority': '(ПРИОРИТЕТ)',
        'see_all': 'СМОТРЕТЬ ВСЕ',
        'what_break': 'ЧТО МОЖЕТ СЛОМАТЬ СЦЕНАРИЙ?',
        'loading_risks': 'Загрузка рисков...',
        'mkt_intel': 'СВОДКА НОВОСТЕЙ',
        'loading': 'Загрузка...',
        'awaiting': 'Ожидание данных...',
        'exposure': 'ЭКСПОЗИЦИЯ И РИСКИ',
        'pnl_all': 'PNL (ЗА ВСЕ ВРЕМЯ)',
        'mkt_exp': 'ЭКСПОЗИЦИЯ РЫНКА',
        'winrate': 'ВИНРЕЙТ',
        'trades': 'ВСЕГО СДЕЛОК',
        'accuracy': 'ТОЧНОСТЬ ИИ',
        'equity': 'КАПИТАЛ',
        'net_bias': 'СОВОКУПНЫЙ БАЙЕС',
        'asset': 'АКТИВ',
        'size': 'ОБЪЕМ',
        'entry': 'ВХОД',
        'price': 'ЦЕНА',
        'pnl': 'PNL',
        'chart': 'ГРАФИК',
        'sltp': 'SL/TP',
        'allocation': 'АЛЛОКАЦИЯ',
        'recent_closes': 'НЕДАВНО ЗАКРЫТЫЕ',
        'sl': 'СТОП-ЛОСС',
        'tp': 'ТЕЙК-ПРОФИТ',
        'unpnl': 'НЕРЕАЛ. PNL',
        'chart_hint': 'Колесико для масштаба &nbsp;&bull;&nbsp; Тяните для перемещения &nbsp;&bull;&nbsp; Двойной клик для сброса',
        'page_title': 'ДЭШБОРД АНАЛИТИКИ',
        
        // Dynamically used keys
        'dyn_no_active': 'Нет открытых позиций',
        'dyn_no_closed': 'Пока нет закрытых сделок',
        'dyn_err_trades': 'Ошибка загрузки сделок',
        'dyn_chart_loading': 'Загрузка графика...',
        'dyn_chart_err': 'Графики не загружены.',
        'dyn_cash': 'КЭШ',
        'dyn_cash_100': 'КЭШ 100%',
        'dyn_long': 'ЛОНГ',
        'dyn_short': 'ШОРТ'
    },
    'en': {
        // En defaults are already correctly written fallback in indicators.html, 
        // but we define dynamic ones here:
        'dyn_no_active': 'No Active Positions',
        'dyn_no_closed': 'No closed trades yet',
        'dyn_err_trades': 'Error loading trades',
        'dyn_chart_loading': 'Loading chart data...',
        'dyn_chart_err': 'Lightweight Charts not loaded.',
        'dyn_cash': 'CASH',
        'dyn_cash_100': 'FLAT 100%',
        'dyn_long': 'LONG',
        'dyn_short': 'SHORT'
    }
};

function getTr(key) {
    if (window.appLang === 'ru' && I18N['ru'][key]) return I18N['ru'][key];
    if (I18N['en'][key]) return I18N['en'][key];
    return key;
}

function applyTranslations() {
    if (window.appLang !== 'ru') {
        // In this implementation, to revert to English we'd need to store original HTML texts, 
        // OR simply reload page. Simplest for 'en' state: force a reload if switching back.
        // But since we want dynamic, let's just reload page on lang switch to be clean.
    } else {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (I18N['ru'][key]) {
                el.innerHTML = I18N['ru'][key];
            }
        });
    }
}


// Position data store for modal chart
const _posChartData = {};
let _lwChart = null;  // active Lightweight Charts instance
let _currentModalCanvasId = null;
let _currentModalTF = '15m';

document.addEventListener('DOMContentLoaded', () => {
    window.appLang = localStorage.getItem('appLang') || 'en';
    
    const langBtns = document.querySelectorAll('.lang-btn');
    if (langBtns.length > 0) {
        langBtns.forEach(btn => {
            if (btn.dataset.lang === window.appLang) btn.classList.add('active');
            else btn.classList.remove('active');
            
            btn.addEventListener('click', () => {
                if (btn.dataset.lang === window.appLang) return;
                window.appLang = btn.dataset.lang;
                localStorage.setItem('appLang', window.appLang);
                window.location.reload(); // Cleanest way to reset EN/RU statically and avoid tracking original EN nodes
            });
        });
    }

    if (window.appLang === 'ru') applyTranslations();
    
    startDashboard();

    // Modal events
    const modal = document.getElementById('chart-modal');
    const closeBtn = document.getElementById('chart-modal-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', closePositionModal);
    if (modal) modal.addEventListener('click', (e) => {
        if (e.target === modal) closePositionModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closePositionModal();
    });

    // Modal timeframe switching
    const tfBtns = document.querySelectorAll('#modal-tf-selector .tf-btn');
    tfBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.classList.contains('active')) return;
            tfBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            _currentModalTF = btn.dataset.tf;
            if (_currentModalCanvasId) {
                openPositionModal(_currentModalCanvasId, _currentModalTF);
            }
        });
    });
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
        renderExposureAndPositions(),
        renderClosedOrders()
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
        
        // Parallel fetch all required data
        const [analysis, fngIndex, marketScan, domStream, forecastRes] = await Promise.allSettled([
            API.getCryptoAnalysis(lang),
            API.getFearGreedIndex(),
            API.getMarketScan(),
            API.getDominanceStreamgraph(),
            API.getMarketForecast(lang)
        ]);

        // --- MARKET STATE (regime) — data-driven, primary ---
        const forecastData = forecastRes.status === "fulfilled" && forecastRes.value?.forecast
            ? forecastRes.value.forecast : null;

        const regime = forecastData?.market_regime || null;
        const bias   = forecastData?.bias || null;
        const direction = forecastData?.direction || null;
        const confidence = forecastData?.confidence ?? null;

        const regimeConfig = {
            "trend":           { label: "TRENDING",   color: "var(--color-green)", desc: "Directional trend confirmed" },
            "chop":            { label: "SIDEWAYS",    color: "var(--text-muted)", desc: "No clear direction" },
            "high_volatility": { label: "VOLATILE",    color: "var(--color-red)",  desc: "High market volatility" },
            "event":           { label: "EVENT",       color: "var(--color-red)",  desc: "Extreme Fear or Greed" },
        };
        const regimeCfg = regime ? regimeConfig[regime] : null;

        const biasEl = document.getElementById('ds-bias');
        const directionBlock = document.getElementById('ds-direction-block');

        if (regimeCfg && biasEl) {
            // Primary: regime
            biasEl.innerText = regimeCfg.label;
            biasEl.style.color = regimeCfg.color;

            // Secondary: LLM bias label
            const biasLabel = bias
                ? `${regimeCfg.desc} · ${bias.toUpperCase()}`
                : regimeCfg.desc;
            if (directionBlock) {
                directionBlock.querySelector('.label').innerText = `MARKET STATE: ${biasLabel}`;
            }

            // Direction block color based on regime
            const regimeLower = regime || '';
            if (regimeLower === 'trend') {
                directionBlock.className = bias === 'bearish'
                    ? 'decision-block primary-bias-block bear'
                    : 'decision-block primary-bias-block';
            } else if (regimeLower === 'high_volatility' || regimeLower === 'event') {
                directionBlock.className = 'decision-block primary-bias-block bear';
            } else {
                directionBlock.className = 'decision-block primary-bias-block neutral';
            }

        } else if (analysis.status === "fulfilled" && analysis.value) {
            // Fallback to old behavior if forecast unavailable
            const data = analysis.value;
            const headline = data.widget_long?.headline || "NEUTRAL";
            if (biasEl) biasEl.innerText = headline;
            if (directionBlock) {
                directionBlock.querySelector('.label').innerText = `BIAS: ${headline}`;
                const hl = headline.toLowerCase();
                directionBlock.className = hl.includes('bull') ? 'decision-block primary-bias-block'
                    : hl.includes('bear') ? 'decision-block primary-bias-block bear'
                    : 'decision-block primary-bias-block neutral';
            }
        }

        // --- CONFIDENCE (from forecast, fallback to crypto-analysis) ---
        const conf = confidence
            ?? analysis.value?.widget_long?.confidence_pct
            ?? 50;
        const confEl = document.getElementById('ds-confidence');
        const confFill = document.getElementById('ds-confidence-fill');
        if (confEl) confEl.innerText = `${conf}%`;
        if (confFill) confFill.style.width = `${conf}%`;

        // --- DIRECTION BUTTON (from forecast) ---
        const dirBtn = document.getElementById('ds-direction-btn');
        if (dirBtn && direction) {
            dirBtn.innerText = direction;
            dirBtn.className = direction === 'LONG' ? 'direction-btn long'
                : direction === 'SHORT' ? 'direction-btn short'
                : 'direction-btn wait';
        }

        // --- FEAR & GREED ---
        if (fngIndex.status === "fulfilled" && fngIndex.value) {
            const fngValEl = document.getElementById('ds-fng-val');
            const fngLblEl = document.getElementById('ds-fng-label');
            if (fngValEl) fngValEl.innerText = fngIndex.value.current_value;
            if (fngLblEl) fngLblEl.innerText = fngIndex.value.current_classification;
        }

        // --- TREND (from market-scan breadth) ---
        if (marketScan.status === "fulfilled" && marketScan.value) {
            const mood = marketScan.value.breadth?.mood || "SIDEWAYS";
            const trendEl = document.getElementById('ds-trend');
            if (trendEl) trendEl.innerText = mood;
        }

        // --- BTC DOMINANCE + VOLATILITY ---
        if (domStream.status === "fulfilled" && domStream.value) {
            const data = domStream.value.data || [];
            if (data.length > 0) {
                const latest = data[data.length - 1];
                const btcEl = document.getElementById('ds-btc-dom');
                if (btcEl) btcEl.innerText = `${latest.btc_dominance.toFixed(1)}%`;
            }
            const marketCapChange = forecastData?.market_cap_24h_change
                ?? domStream.value.market_cap_24h_change;
            if (marketCapChange !== undefined) {
                const volEl = document.getElementById('ds-volatility');
                const isHigh = Math.abs(marketCapChange) > 3;
                if (volEl) {
                    volEl.innerText = isHigh ? "HIGH VOLATILITY" : "LOW VOLATILITY";
                    volEl.style.color = isHigh ? "var(--color-red)" : "var(--text-muted)";
                }
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
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">${getTr('dyn_no_active')}</td></tr>`;
            document.getElementById('exp-net-bias').innerText = getTr('dyn_cash_100');
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
                            <div style="font-size: 0.7rem; font-weight: 800; color: var(--color-${isLong ? 'green' : 'red'});">${isLong ? getTr('dyn_long') : getTr('dyn_short')}</div>
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
                const isLong = pos.side.toLowerCase() === 'buy';
                const price = sparklineData ? sparklineData[sparklineData.length - 1] : pos.entry_price;
                const pnlValue = isLong ? (price - pos.entry_price) * pos.size
                                        : (pos.entry_price - price) * pos.size;

                if (sparklineData) {
                    drawBrutalSparkline(`pos-chart-${pos.id}`, sparklineData, isLong, {
                        entry: pos.entry_price,
                        sl: pos.sl_price,
                        tp: pos.tp_price
                    });
                    // Store for modal
                    _posChartData[`pos-chart-${pos.id}`] = { pos, sparklineData, currentPrice: price, pnlValue };
                }

                // Make chart cell open modal on click
                const td = document.getElementById(`pos-chart-${pos.id}`)?.parentElement;
                if (td) td.addEventListener('click', () => openPositionModal(`pos-chart-${pos.id}`));
            });

            // Calculate detailed allocation
            let allocHtml = '';
            let btcVal = 0, ethVal = 0, altsVal = 0;
            const equity = stats && stats.balance_history && stats.balance_history.length > 0 
                ? stats.balance_history[stats.balance_history.length - 1].equity 
                : 0;
            let currentAssetVal = 0;
            
            // Just for demonstration logic based on Positions
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
                if (cPct > 0) allocHtml += `<div style="width:${cPct}%; background:var(--color-green); color:#000; display:flex; align-items:center; justify-content:center;">${getTr('dyn_cash')} ${cPct.toFixed(0)}%</div>`;
            } else {
                allocHtml = `<div style="width:100%; background:var(--color-green); color:#000; display:flex; align-items:center; justify-content:center;">${getTr('dyn_cash_100')}</div>`;
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
// CLOSED ORDERS
// ----------------------------------------------------
function formatHoldTime(minutes) {
    if (minutes === null || minutes === undefined) return 'вЂ”';
    const totalMins = Math.round(minutes);
    if (totalMins < 60) return `${totalMins}m`;
    if (totalMins < 1440) {
        const hrs = Math.floor(totalMins / 60);
        const mins = totalMins % 60;
        return `${hrs}h ${mins}m`;
    }
    const days = Math.floor(totalMins / 1440);
    const hrs = Math.floor((totalMins % 1440) / 60);
    return `${days}d ${hrs}h`;
}

async function renderClosedOrders() {
    const listEl = document.getElementById('closed-orders-list');
    const badgeEl = document.getElementById('closed-count-badge');
    if (!listEl) return;

    try {
        // last_10_trades comes from /stats вЂ” already fetched in renderExposureAndPositions,
        // but we fetch independently to keep functions decoupled.
        const stats = await API.getBotStats().catch(() => null);

        const trades = stats?.last_10_trades;
        if (!trades || trades.length === 0) {
            listEl.innerHTML = `<div class="closed-order-empty">${getTr('dyn_no_closed')}</div>`;
            if (badgeEl) badgeEl.textContent = '0';
            return;
        }

        if (badgeEl) badgeEl.textContent = trades.length;

        const html = trades.map(t => {
            const isWin = t.pnl >= 0;
            const iconClass = isWin ? 'win' : 'loss';
            const icon = isWin ? '✓' : '✕';
            const pnlSign = t.pnl > 0 ? '+' : '';
            const sym = String(t.symbol).replace('USDT', '');
            const isLong = String(t.side).toLowerCase() === 'buy';
            const sideLabel = isLong ? 'LONG' : 'SHORT';
            const sideClass = isLong ? 'long' : 'short';
            const holdStr = formatHoldTime(t.hold_minutes);

            return `
                <div class="closed-order-row">
                    <div class="closed-order-icon ${iconClass}">${icon}</div>
                    <div class="closed-order-info">
                        <div class="closed-order-symbol">${sym}</div>
                        <div class="closed-order-meta">
                            <span class="closed-order-side ${sideClass}">${sideLabel}</span>
                            <span class="closed-order-duration">⏱ ${holdStr}</span>
                        </div>
                    </div>
                    <div class="closed-order-pnl ${iconClass}">${pnlSign}$${t.pnl.toFixed(2)}</div>
                </div>
            `;
        }).join('');

        listEl.innerHTML = html;
    } catch(e) {
        console.error('Closed orders error:', e);
        listEl.innerHTML = `<div class="closed-order-empty">${getTr('dyn_err_trades')}</div>`;
    }
}

// ----------------------------------------------------
// UTILS
// ----------------------------------------------------
function drawBrutalSparkline(canvasId, dataPoints, isUp = true, levels = null) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const lineColor = isUp ? '#000000' : '#FF1744';
    const hasLevels = !!(levels && (levels.entry || levels.sl || levels.tp));

    // Y range - strictly based on price data to keep sparkline large
    const minVal = Math.min(...dataPoints);
    const maxVal = Math.max(...dataPoints);

    // Find closest index to entry price for stake position
    let entryIdx = 0;
    if (hasLevels && levels.entry) {
        let minDiff = Infinity;
        dataPoints.forEach((v, i) => {
            const d = Math.abs(v - levels.entry);
            if (d < minDiff) { minDiff = d; entryIdx = i; }
        });
    }

    // Compact entry stake (no labels вЂ” just visual markers for thumbnail)
    const stakePlugin = hasLevels ? {
        id: 'stake_' + canvasId,
        afterDraw(chart) {
            const { ctx: c, scales } = chart;
            if (!scales.y || !scales.x || !levels.entry) return;
            const xPx = scales.x.getPixelForValue(entryIdx);
            const yE  = scales.y.getPixelForValue(levels.entry);
            const yTP = levels.tp ? scales.y.getPixelForValue(levels.tp) : null;
            const ySL = levels.sl ? scales.y.getPixelForValue(levels.sl) : null;
            const tw  = 6;

            c.save();
            c.lineCap = 'round';

            // Connector
            c.beginPath();
            c.moveTo(xPx, yTP ?? yE);
            c.lineTo(xPx, ySL ?? yE);
            c.strokeStyle = 'rgba(0,0,0,0.2)';
            c.lineWidth = 1;
            c.setLineDash([2, 2]);
            c.stroke();
            c.setLineDash([]);

            // TP tick
            if (yTP !== null) {
                c.beginPath(); c.moveTo(xPx - tw, yTP); c.lineTo(xPx + tw, yTP);
                c.strokeStyle = '#00C853'; c.lineWidth = 2; c.stroke();
            }
            // SL tick
            if (ySL !== null) {
                c.beginPath(); c.moveTo(xPx - tw, ySL); c.lineTo(xPx + tw, ySL);
                c.strokeStyle = '#FF1744'; c.lineWidth = 2; c.stroke();
            }
            // Entry dot
            c.beginPath();
            c.arc(xPx, yE, 3.5, 0, Math.PI * 2);
            c.fillStyle = 'rgba(255,214,0,0.4)';
            c.fill();
            c.strokeStyle = '#FFD600';
            c.lineWidth = 1.5;
            c.stroke();

            c.restore();
        }
    } : null;

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: dataPoints.map((_, i) => i),
            datasets: [{ data: dataPoints, borderColor: lineColor, borderWidth: 1.2,
                tension: 0, pointRadius: 0, fill: false }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            scales: {
                x: { display: false },
                y: { display: false, min: minVal * 0.997, max: maxVal * 1.003 }
            },
            layout: { padding: 4 },
            animation: false
        },
        plugins: stakePlugin ? [stakePlugin] : []
    });
}

// ----------------------------------------------------
// POSITION CHART MODAL  (Lightweight Charts)
// ----------------------------------------------------
function _fmtModalPrice(v) {
    if (!v && v !== 0) return '--';
    if (v >= 10000) return `$${(v / 1000).toFixed(2)}k`;
    if (v >= 1)     return `$${v.toFixed(2)}`;
    return `$${v.toFixed(5)}`;
}

async function openPositionModal(canvasId, timeframe = '15m') {
    _currentModalCanvasId = canvasId;
    _currentModalTF = timeframe;
    try {
        const data = _posChartData[canvasId];
        if (!data) return;

        const { pos, sparklineData, pnlValue } = data;
        const isLong = pos?.side?.toLowerCase() === 'buy';
        const sym = pos?.symbol ? String(pos.symbol).replace('USDT', '') : '--';

        // Populate header
        document.getElementById('modal-symbol').textContent = sym;
        const badge = document.getElementById('modal-side-badge');
        if (badge) {
            badge.textContent = isLong ? getTr('dyn_long') : getTr('dyn_short');
            badge.className = `closed-order-side ${isLong ? 'long' : 'short'}`;
        }
        document.getElementById('modal-entry').textContent = _fmtModalPrice(pos?.entry_price);
        document.getElementById('modal-sl').textContent    = _fmtModalPrice(pos?.sl_price);
        document.getElementById('modal-tp').textContent    = _fmtModalPrice(pos?.tp_price);

        const pnlEl = document.getElementById('modal-pnl');
        if (pnlEl && pnlValue !== undefined) {
            const pnlSign = pnlValue >= 0 ? '+' : '';
            pnlEl.textContent = `${pnlSign}$${Math.abs(pnlValue).toFixed(2)}`;
            pnlEl.className = `chart-modal-stat-value ${pnlValue >= 0 ? 'text-green' : 'text-red'}`;
        }

        // Show overlay
        const modal = document.getElementById('chart-modal');
        if (modal) {
            modal.classList.add('open');
            document.body.style.overflow = 'hidden';
        }

        // Destroy previous chart
        if (_lwChart) { _lwChart.remove(); _lwChart = null; }
        const container = document.getElementById('chart-modal-chart');
        if (!container) return;
        container.innerHTML = `<div style="padding:2rem;text-align:center;color:#555;font-family:monospace">${getTr('dyn_chart_loading')}</div>`;

        if (typeof LightweightCharts === 'undefined') {
            container.innerHTML = `<div style="padding:2rem;text-align:center;color:#555;font-family:monospace">${getTr('dyn_chart_err')}</div>`;
            return;
        }

        let klines = [];
        try {
            if (API.getKlinesForSymbol) {
                const res = await API.getKlinesForSymbol(pos.symbol, timeframe);
                if (res && res.klines) {
                    klines = res.klines;
                }
            }
        } catch(e) {
            console.error('Failed to fetch klines for modal', e);
        }

        container.innerHTML = '';

        // Create chart
        _lwChart = LightweightCharts.createChart(container, {
            width:  container.clientWidth,
            height: container.clientHeight,
            layout: {
                background: { color: '#FFFFFF' },
                textColor: '#000000',
                fontFamily: "'Space Mono', 'Space Grotesk', monospace",
                fontSize: 11,
            },
            grid: {
                vertLines: { color: 'rgba(0,0,0,0.05)' },
                horzLines: { color: 'rgba(0,0,0,0.05)' },
            },
            crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
            rightPriceScale: {
                borderColor: 'rgba(0,0,0,0.15)',
                scaleMargins: { top: 0.15, bottom: 0.15 },
            },
            timeScale: {
                borderColor: 'rgba(0,0,0,0.15)',
                timeVisible: true,
                secondsVisible: false,
                fixLeftEdge: true,
                fixRightEdge: true,
            },
            handleScale: { mouseWheel: true, pinch: true },
            handleScroll: { mouseWheel: true, pressedMouseMove: true },
        });

        let series;
        let allPriceValues = [];

        // Check if klines is valid and has valid data points
        const validKlines = klines.filter(k => k.close != null && k.open != null && k.high != null && k.low != null);

        if (validKlines.length > 0) {
            const lwData = validKlines.map(k => ({
                time: typeof k.open_time === 'number' ? 
                        (k.open_time > 1e10 ? Math.floor(k.open_time / 1000) : k.open_time) : 
                        k.open_time,
                open: k.open,
                high: k.high,
                low: k.low,
                close: k.close
            }));

            // Filter out duplicate or invalid times
            const uniqueData = [];
            const timesSet = new Set();
            lwData.sort((a,b) => a.time - b.time).forEach(d => {
                if(!timesSet.has(d.time) && !isNaN(d.time)) {
                    timesSet.add(d.time);
                    uniqueData.push(d);
                }
            });

            series = _lwChart.addCandlestickSeries({
                upColor: '#00C853',
                downColor: '#FF1744',
                borderVisible: false,
                wickUpColor: '#00C853',
                wickDownColor: '#FF1744',
            });
            series.setData(uniqueData);
            allPriceValues = uniqueData.map(k => k.high).concat(uniqueData.map(k => k.low));
        } else if (sparklineData && sparklineData.length > 0) {
            // Fallback to AreaSeries and sparkline
            const N = sparklineData.length;
            const nowSec = Math.floor(Date.now() / 1000);
            const stepSec = Math.floor((24 * 3600) / Math.max(N - 1, 1));
            const lwData = sparklineData.map((price, i) => ({
                time: nowSec - (N - 1 - i) * stepSec,
                value: price
            })).filter(d => d.value != null && !isNaN(d.time));

            series = _lwChart.addAreaSeries({
                lineColor: isLong ? '#000000' : '#FF1744',
                topColor:  isLong ? 'rgba(0,0,0,0.08)' : 'rgba(255,23,68,0.07)',
                bottomColor: 'rgba(0,0,0,0)',
                lineWidth: 2,
                crosshairMarkerVisible: true,
                crosshairMarkerRadius: 5,
                crosshairMarkerBorderColor: isLong ? '#000' : '#FF1744',
                crosshairMarkerBackgroundColor: '#fff',
                priceLineVisible: false,
            });
            series.setData(lwData);
            allPriceValues = [...sparklineData]; // Copy to avoid mutating original
        } else {
            container.innerHTML = '<div style="padding:2rem;text-align:center;color:#555;">No data available.</div>';
            return;
        }

        // Entry price line
        if (pos?.entry_price) {
            series.createPriceLine({
                price: pos.entry_price,
                color: '#FFD600',
                lineWidth: 2,
                lineStyle: LightweightCharts.LineStyle.Dashed,
                axisLabelVisible: true,
                title: 'ENTRY',
            });
            allPriceValues.push(pos.entry_price);
        }
        // Take Profit line
        if (pos?.tp_price) {
            series.createPriceLine({
                price: pos.tp_price,
                color: '#00C853',
                lineWidth: 2,
                lineStyle: LightweightCharts.LineStyle.Dashed,
                axisLabelVisible: true,
                title: 'TP',
            });
            allPriceValues.push(pos.tp_price);
        }
        // Stop Loss line
        if (pos?.sl_price) {
            series.createPriceLine({
                price: pos.sl_price,
                color: '#FF1744',
                lineWidth: 2,
                lineStyle: LightweightCharts.LineStyle.Dashed,
                axisLabelVisible: true,
                title: 'SL',
            });
        }

        _lwChart.timeScale().fitContent();

        // Responsive resize
        const ro = new ResizeObserver(() => {
            if (_lwChart && container.clientWidth > 0) {
                _lwChart.applyOptions({
                    width:  container.clientWidth,
                    height: container.clientHeight
                });
            }
        });
        ro.observe(container);

    } catch (err) {
        console.error("Error in openPositionModal:", err);
        alert('Could not open modal: ' + err.message);
    }
}

function closePositionModal() {
    const modal = document.getElementById('chart-modal');
    if (modal) modal.classList.remove('open');
    document.body.style.overflow = '';
    if (_lwChart) { _lwChart.remove(); _lwChart = null; }
}

