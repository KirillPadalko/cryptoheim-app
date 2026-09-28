import { API } from './api.js';

const REFRESH_MS = 60000;
const GREEN = 'var(--bot-green)';
const RED = 'var(--bot-red)';
const WHITE = 'var(--bot-white)';

const I18N = {
    ru: {
        live: 'ОНЛАЙН', offline: 'НЕТ СВЯЗИ', now: 'СЕЙЧАС', allTime: 'ЗА ВСЁ ВРЕМЯ',
        tradingPnl: 'PNL ТОРГОВЛИ',
        chartNote: 'Накопленный реализованный PnL закрытых сделок — без учёта ввода/вывода и переводов',
        balanceTitle: 'БАЛАНС СЧЁТА', statsTitle: 'СТАТИСТИКА ПО ЗАКРЫТЫМ СДЕЛКАМ',
        positionsTitle: 'ОТКРЫТЫЕ ПОЗИЦИИ', changelogTitle: 'ЛОГ ИЗМЕНЕНИЙ СТРАТЕГИИ',
        pair: 'ПАРА', side: 'СТОРОНА', opened: 'ОТКРЫТА', closed: 'ЗАКРЫТА', entry: 'ВХОД', pnl: 'PNL',
        closedTitle: 'ЗАКРЫТЫЕ СДЕЛКИ',
        disclaimer: 'Результаты в прошлом не гарантируют доходность в будущем.', updated: 'ОБНОВЛЕНО',
        noPositions: 'Открытых позиций нет.', noData: 'Нет данных.',
        statLabels: {
            winRate: 'ВИНРЕЙТ', totalTrades: 'ВСЕГО СДЕЛОК', totalPnl: 'ОБЩИЙ PNL', profitFactor: 'ПРОФИТ-ФАКТОР',
            avgWin: 'СРЕДНИЙ ПРОФИТ', avgLoss: 'СРЕДНИЙ УБЫТОК', maxDrawdown: 'МАКС. ПРОСАДКА', bestTrade: 'ЛУЧШАЯ СДЕЛКА'
        }
    },
    en: {
        live: 'LIVE', offline: 'OFFLINE', now: 'NOW', allTime: 'ALL TIME',
        tradingPnl: 'TRADING PNL',
        chartNote: 'Cumulative realized PnL of closed trades — excludes deposits, withdrawals and transfers',
        balanceTitle: 'ACCOUNT BALANCE', statsTitle: 'CLOSED TRADES STATS',
        positionsTitle: 'OPEN POSITIONS', changelogTitle: 'STRATEGY CHANGELOG',
        pair: 'PAIR', side: 'SIDE', opened: 'OPENED', closed: 'CLOSED', entry: 'ENTRY', pnl: 'PNL',
        closedTitle: 'CLOSED TRADES',
        disclaimer: 'Past performance does not guarantee future results.', updated: 'UPDATED',
        noPositions: 'No open positions.', noData: 'No data.',
        statLabels: {
            winRate: 'WIN RATE', totalTrades: 'TOTAL TRADES', totalPnl: 'TOTAL PNL', profitFactor: 'PROFIT FACTOR',
            avgWin: 'AVG WIN', avgLoss: 'AVG LOSS', maxDrawdown: 'MAX DRAWDOWN', bestTrade: 'BEST TRADE'
        }
    }
};

let lang = localStorage.getItem('bot_lang') || 'ru';
let data = { account: null, stats: null, positions: [], history: [], changelog: [] };

const $ = (id) => document.getElementById(id);

function escapeHtml(v) {
    return String(v ?? '').replace(/[&<>"']/g, (c) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
}

function num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }

function usd(v, sign = false) {
    const n = num(v);
    if (n === null) return '—';
    const s = sign && n > 0 ? '+' : n < 0 ? '-' : '';
    return `${s}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pct(v, sign = true) {
    const n = num(v);
    if (n === null) return '—';
    const s = sign && n > 0 ? '+' : '';
    return `${s}${n.toFixed(1)}%`;
}

function toDate(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') return new Date(v > 1e12 ? v : v * 1000);
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
}

function fmtUTC(v) {
    const d = toDate(v) || new Date();
    const p = (x) => String(x).padStart(2, '0');
    return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`;
}

function formatPair(symbol) {
    const s = String(symbol || '').toUpperCase();
    return s.endsWith('USDT') ? `${s.slice(0, -4)}/USDT` : s;
}

// ─── Derived stats the backend does not expose ───
// All computed from trade PnL, so deposits/withdrawals/transfers never enter.
function computeExtraStats(history) {
    const pnls = (history || []).map((t) => num(t.pnl)).filter((n) => n !== null && n !== 0);
    const wins = pnls.filter((n) => n > 0);
    const losses = pnls.filter((n) => n < 0);

    const grossWin = wins.reduce((a, b) => a + b, 0);
    const grossLoss = Math.abs(losses.reduce((a, b) => a + b, 0));
    const profitFactor = grossLoss > 0 ? grossWin / grossLoss : (grossWin > 0 ? Infinity : null);
    const avgWin = wins.length ? grossWin / wins.length : null;
    const avgLoss = losses.length ? -grossLoss / losses.length : null;

    // Max drawdown of cumulative realized PnL, in USD (peak-to-trough).
    let maxDDUsd = null;
    const chron = (history || [])
        .map((t) => ({ ts: num(t.close_time), pnl: num(t.pnl) }))
        .filter((t) => t.ts !== null && t.pnl !== null && t.pnl !== 0)
        .sort((a, b) => a.ts - b.ts);
    if (chron.length) {
        let cum = 0, peak = 0, worst = 0;
        for (const t of chron) {
            cum += t.pnl;
            if (cum > peak) peak = cum;
            worst = Math.min(worst, cum - peak);
        }
        maxDDUsd = worst;
    }
    return { profitFactor, avgWin, avgLoss, maxDrawdownUsd: maxDDUsd };
}

// ─── Renderers ───
function renderStaticI18n() {
    const t = I18N[lang];
    document.querySelectorAll('[data-i18n]').forEach((el) => {
        const key = el.getAttribute('data-i18n');
        if (t[key]) el.textContent = t[key];
    });
    document.documentElement.lang = lang;
    document.querySelectorAll('.lang-btn').forEach((b) => {
        b.classList.toggle('active', b.dataset.lang === lang);
    });
}

// Cumulative realized PnL of closed trades over time. Deposit/withdrawal/
// transfer-free by construction — it only ever sums trade PnL.
function pnlSeries() {
    const trades = (data.history || [])
        .map((t) => ({ ts: num(t.close_time), pnl: num(t.pnl) }))
        .filter((t) => t.ts !== null && t.pnl !== null)
        .sort((a, b) => a.ts - b.ts);
    let cum = 0;
    return trades.map((t) => { cum += t.pnl; return { ts: t.ts, v: cum }; });
}

function renderBalance() {
    const t = I18N[lang];
    const bh = pnlSeries();

    // Big number stays the real live account balance (actual money on the account).
    const liveEquity = num(data.account?.equity_usdt);
    $('balance-num').textContent = liveEquity === null ? '$—' : usd(liveEquity);

    // Badge shows the pure trading result (total realized PnL), not balance growth.
    const totalPnl = bh.length ? bh[bh.length - 1].v : num(data.stats?.total_pnl_usdt);
    const badge = $('pnl-badge');
    if (totalPnl !== null) {
        badge.textContent = `${usd(totalPnl, true)} · ${t.tradingPnl}`;
        badge.style.color = totalPnl >= 0 ? GREEN : RED;
    } else {
        badge.textContent = '—';
        badge.style.color = 'var(--bot-muted)';
    }

    // Trading-PnL curve
    const line = $('equity-line');
    const area = $('equity-area');
    if (bh.length >= 2) {
        const W = 760, H = 180;
        const vals = bh.map((p) => p.v);
        const min = Math.min(...vals), max = Math.max(...vals);
        const range = max - min || 1;
        const pts = bh.map((p, i) => {
            const x = (i / (bh.length - 1)) * W;
            const y = H - ((p.v - min) / range) * (H - 10) - 5;
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        });
        const rising = vals[vals.length - 1] >= vals[0];
        const stroke = rising ? GREEN : RED;
        line.setAttribute('points', pts.join(' '));
        line.setAttribute('stroke', stroke);
        area.setAttribute('points', `0,${H} ${pts.join(' ')} ${W},${H}`);
        renderEquityAxis(bh);
    } else {
        line.setAttribute('points', '');
        area.setAttribute('points', '');
        renderEquityAxis([]);
    }
}

// Time-axis label: DD.MM, plus HH:MM when the range is short enough that
// bare dates would repeat.
function formatTick(ts, withTime) {
    const d = toDate(ts);
    if (!d) return '';
    const p = (x) => String(x).padStart(2, '0');
    const date = `${p(d.getDate())}.${p(d.getMonth() + 1)}`;
    return withTime ? `${date} ${p(d.getHours())}:${p(d.getMinutes())}` : date;
}

// Distribute date ticks along the equity curve, aligned with the plotted
// (index-spaced) points so labels sit under their data.
function renderEquityAxis(bh) {
    const axis = $('equity-axis');
    if (!axis) return;
    if (!bh || bh.length < 2) { axis.innerHTML = ''; return; }

    const t0 = toDate(bh[0].ts)?.getTime();
    const t1 = toDate(bh[bh.length - 1].ts)?.getTime();
    const spanDays = (t0 && t1) ? (t1 - t0) / 86400000 : 0;
    const withTime = spanDays <= 3;
    const ticks = Math.min(withTime ? 4 : 6, bh.length);

    const seen = new Set();
    const spans = [];
    for (let i = 0; i < ticks; i++) {
        const idx = Math.round((i / (ticks - 1)) * (bh.length - 1));
        if (seen.has(idx)) continue;
        seen.add(idx);
        spans.push(`<span>${escapeHtml(formatTick(bh[idx].ts, withTime))}</span>`);
    }
    axis.innerHTML = spans.join('');
}

function renderStats() {
    const t = I18N[lang];
    const s = data.stats || {};
    const extra = computeExtraStats(data.history);

    const pf = extra.profitFactor;
    const cards = [
        { label: t.statLabels.winRate, value: s.win_rate_pct != null ? `${Number(s.win_rate_pct).toFixed(1)}%` : '—', color: WHITE },
        { label: t.statLabels.totalTrades, value: s.total_closed_trades != null ? String(s.total_closed_trades) : '—', color: WHITE },
        { label: t.statLabels.totalPnl, value: usd(s.total_pnl_usdt, true), color: num(s.total_pnl_usdt) >= 0 ? GREEN : RED },
        { label: t.statLabels.profitFactor, value: pf === null ? '—' : (pf === Infinity ? '∞' : pf.toFixed(2)), color: WHITE },
        { label: t.statLabels.avgWin, value: usd(extra.avgWin, true), color: GREEN },
        { label: t.statLabels.avgLoss, value: usd(extra.avgLoss, true), color: RED },
        { label: t.statLabels.maxDrawdown, value: extra.maxDrawdownUsd === null ? '—' : usd(extra.maxDrawdownUsd, true), color: RED },
        { label: t.statLabels.bestTrade, value: usd(s.best_trade_pnl, true), color: GREEN }
    ];

    $('stats-grid').innerHTML = cards.map((c) => `
        <div class="stat">
            <div class="stat-label">${escapeHtml(c.label)}</div>
            <div class="stat-value" style="color:${c.color}">${escapeHtml(c.value)}</div>
        </div>
    `).join('');
}

// Note attached by the backend to trades of a named mechanism (open_context.comment = {ru, en}).
function tradeComment(p) {
    const c = p && p.open_context && p.open_context.comment;
    const text = c && (c[lang] || c.en || c.ru);
    return text ? `<div class="pos-comment">${escapeHtml(text)}</div>` : '';
}

function renderPositions() {
    const t = I18N[lang];
    const list = Array.isArray(data.positions) ? data.positions : [];
    const body = $('positions-body');

    if (list.length === 0) {
        body.innerHTML = `<div class="pos-empty">${escapeHtml(t.noPositions)}</div>`;
        return;
    }

    body.innerHTML = list.map((p) => {
        const sideRaw = String(p.side || '').toUpperCase();
        const isLong = sideRaw === 'BUY' || sideRaw === 'LONG';
        const side = isLong ? 'LONG' : 'SHORT';

        // Actual unrealized PnL in USD: (mark − entry) × size, sign-flipped for shorts.
        const entry = num(p.entry_price);
        const mark = num(p.mark_price ?? p.price);
        const size = num(p.size);
        let pnlUsd = null;
        if (entry !== null && mark !== null && size !== null) {
            const diff = (isLong ? 1 : -1) * (mark - entry);
            pnlUsd = diff * size;
        }
        const pnlColor = (pnlUsd ?? 0) >= 0 ? GREEN : RED;

        return `
            <div class="pos-row">
                <div class="pos-pair">${escapeHtml(formatPair(p.symbol))}</div>
                <div style="color:${isLong ? GREEN : RED}">[${side}]</div>
                <div class="pos-time">${escapeHtml(formatTick(p.open_time, true))}</div>
                <div class="pos-entry">${escapeHtml(p.entry_price ?? '—')}</div>
                <div class="pos-pnl r" style="color:${pnlColor}">${pnlUsd === null ? '—' : usd(pnlUsd, true)}</div>
                ${tradeComment(p)}
            </div>
        `;
    }).join('');
}

// Recent closed trades, newest first. Realized PnL comes straight from the row.
function renderClosed() {
    const t = I18N[lang];
    const body = $('closed-body');
    if (!body) return;

    const list = (Array.isArray(data.history) ? data.history : [])
        .filter((x) => x)
        .slice()
        .sort((a, b) => (num(b.close_time) || 0) - (num(a.close_time) || 0))
        .slice(0, 25);

    if (list.length === 0) {
        body.innerHTML = `<div class="pos-empty">${escapeHtml(t.noData)}</div>`;
        return;
    }

    body.innerHTML = list.map((p) => {
        const sideRaw = String(p.side || '').toUpperCase();
        const isLong = sideRaw === 'BUY' || sideRaw === 'LONG';
        const side = isLong ? 'LONG' : 'SHORT';
        const pnl = num(p.pnl);
        const pnlColor = (pnl ?? 0) >= 0 ? GREEN : RED;
        return `
            <div class="pos-row">
                <div class="pos-pair">${escapeHtml(formatPair(p.symbol))}</div>
                <div style="color:${isLong ? GREEN : RED}">[${side}]</div>
                <div class="pos-time">${escapeHtml(formatTick(p.close_time, true))}</div>
                <div class="pos-entry">${escapeHtml(p.entry_price ?? '—')}</div>
                <div class="pos-pnl r" style="color:${pnlColor}">${pnl === null ? '—' : usd(pnl, true)}</div>
                ${tradeComment(p)}
            </div>
        `;
    }).join('');
}

function renderChangelog() {
    const t = I18N[lang];
    const list = Array.isArray(data.changelog) ? data.changelog : [];
    const body = $('changelog-body');

    if (list.length === 0) {
        body.innerHTML = `<div class="log-item"><div class="log-desc">${escapeHtml(t.noData)}</div></div>`;
        return;
    }

    const sorted = [...list].sort((a, b) => String(b.date).localeCompare(String(a.date)));
    body.innerHTML = sorted.map((c) => {
        const tag = c.tag || (c.type ? String(c.type).toUpperCase() : 'LOG');
        const desc = c[lang] || c.text || c.en || c.ru || '';
        return `
            <div class="log-item">
                <div class="log-meta">
                    <span class="log-tag">${escapeHtml(tag)}</span>
                    <span class="log-date">${escapeHtml(c.date || '')}</span>
                </div>
                <div class="log-desc">${escapeHtml(desc)}</div>
            </div>
        `;
    }).join('');
}

function renderLive() {
    const t = I18N[lang];
    const ok = data.account ? data.account.exchange_ok !== false : true;
    $('live-label').textContent = ok ? t.live : t.offline;
    $('live-dot').style.background = ok ? GREEN : RED;
    $('updated-at').textContent = fmtUTC(data.account?.updated_at);
}

function renderAll() {
    renderStaticI18n();
    renderBalance();
    renderStats();
    renderPositions();
    renderClosed();
    renderChangelog();
    renderLive();
}

// ─── Boot ───
async function load() {
    const [account, stats, positions, history, changelog] = await Promise.all([
        API.getBotAccount().catch(() => null),
        API.getBotStats().catch(() => null),
        API.getBotPositions().catch(() => []),
        API.getBotHistory(1000).catch(() => []),
        API.getBotChangelog().catch(() => [])
    ]);
    data = {
        account,
        stats,
        positions: Array.isArray(positions) ? positions : [],
        history: Array.isArray(history) ? history : (history?.history || []),
        changelog: Array.isArray(changelog) ? changelog : []
    };
    renderAll();
}

document.querySelectorAll('.lang-btn').forEach((b) => {
    b.addEventListener('click', () => {
        lang = b.dataset.lang;
        localStorage.setItem('bot_lang', lang);
        renderAll();
    });
});

renderAll();
load();
setInterval(load, REFRESH_MS);
