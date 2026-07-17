import { API } from './api.js';

const REFRESH_MS = 60000;
const GREEN = 'var(--bot-green)';
const RED = 'var(--bot-red)';
const WHITE = 'var(--bot-white)';

const I18N = {
    ru: {
        live: 'ОНЛАЙН', offline: 'НЕТ СВЯЗИ', now: 'СЕЙЧАС', allTime: 'ЗА ВСЁ ВРЕМЯ',
        balanceTitle: 'БАЛАНС СЧЁТА', statsTitle: 'СТАТИСТИКА ПО ЗАКРЫТЫМ СДЕЛКАМ',
        positionsTitle: 'ОТКРЫТЫЕ ПОЗИЦИИ', changelogTitle: 'ЛОГ ИЗМЕНЕНИЙ СТРАТЕГИИ',
        pair: 'ПАРА', side: 'СТОРОНА', entry: 'ВХОД', pnl: 'PNL',
        disclaimer: 'Результаты в прошлом не гарантируют доходность в будущем.', updated: 'ОБНОВЛЕНО',
        noPositions: 'Открытых позиций нет.', noData: 'Нет данных.',
        statLabels: {
            winRate: 'ВИНРЕЙТ', totalTrades: 'ВСЕГО СДЕЛОК', totalPnl: 'ОБЩИЙ PNL', profitFactor: 'ПРОФИТ-ФАКТОР',
            avgWin: 'СРЕДНИЙ ПРОФИТ', avgLoss: 'СРЕДНИЙ УБЫТОК', maxDrawdown: 'МАКС. ПРОСАДКА', bestTrade: 'ЛУЧШАЯ СДЕЛКА'
        }
    },
    en: {
        live: 'LIVE', offline: 'OFFLINE', now: 'NOW', allTime: 'ALL TIME',
        balanceTitle: 'ACCOUNT BALANCE', statsTitle: 'CLOSED TRADES STATS',
        positionsTitle: 'OPEN POSITIONS', changelogTitle: 'STRATEGY CHANGELOG',
        pair: 'PAIR', side: 'SIDE', entry: 'ENTRY', pnl: 'PNL',
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
function computeExtraStats(history, balanceHistory) {
    const pnls = (history || []).map((t) => num(t.pnl)).filter((n) => n !== null && n !== 0);
    const wins = pnls.filter((n) => n > 0);
    const losses = pnls.filter((n) => n < 0);

    const grossWin = wins.reduce((a, b) => a + b, 0);
    const grossLoss = Math.abs(losses.reduce((a, b) => a + b, 0));
    const profitFactor = grossLoss > 0 ? grossWin / grossLoss : (grossWin > 0 ? Infinity : null);
    const avgWin = wins.length ? grossWin / wins.length : null;
    const avgLoss = losses.length ? -grossLoss / losses.length : null;

    // Max drawdown from equity curve (peak-to-trough %)
    let maxDD = null;
    const eq = (balanceHistory || []).map((h) => num(h.equity)).filter((n) => n !== null);
    if (eq.length >= 2) {
        let peak = eq[0];
        let worst = 0;
        for (const v of eq) {
            if (v > peak) peak = v;
            if (peak > 0) worst = Math.min(worst, (v - peak) / peak * 100);
        }
        maxDD = worst;
    }
    return { profitFactor, avgWin, avgLoss, maxDrawdown: maxDD };
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

function renderBalance() {
    const t = I18N[lang];
    const bh = (data.stats?.balance_history || [])
        .map((h) => ({ ts: num(h.timestamp), v: num(h.equity) }))
        .filter((p) => p.v !== null)
        .sort((a, b) => a.ts - b.ts);

    const liveEquity = num(data.account?.equity_usdt);
    const lastEquity = bh.length ? bh[bh.length - 1].v : null;
    const startEquity = bh.length ? bh[0].v : null;
    const balance = liveEquity ?? lastEquity;

    $('balance-num').textContent = balance === null ? '$—' : usd(balance);

    const badge = $('pnl-badge');
    if (startEquity && balance !== null && startEquity > 0) {
        const p = (balance - startEquity) / startEquity * 100;
        badge.textContent = `${pct(p)} ${t.allTime}`;
        badge.style.color = p >= 0 ? GREEN : RED;
    } else {
        badge.textContent = '—';
        badge.style.color = 'var(--bot-muted)';
    }

    // Equity curve
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
        const startDate = toDate(bh[0].ts);
        $('chart-start').textContent = startDate
            ? `−${Math.max(1, Math.round((Date.now() - startDate.getTime()) / 86400000))}D`
            : '';
    } else {
        line.setAttribute('points', '');
        area.setAttribute('points', '');
        $('chart-start').textContent = '';
    }
}

function renderStats() {
    const t = I18N[lang];
    const s = data.stats || {};
    const extra = computeExtraStats(data.history, s.balance_history);

    const pf = extra.profitFactor;
    const cards = [
        { label: t.statLabels.winRate, value: s.win_rate_pct != null ? `${Number(s.win_rate_pct).toFixed(1)}%` : '—', color: WHITE },
        { label: t.statLabels.totalTrades, value: s.total_closed_trades != null ? String(s.total_closed_trades) : '—', color: WHITE },
        { label: t.statLabels.totalPnl, value: usd(s.total_pnl_usdt, true), color: num(s.total_pnl_usdt) >= 0 ? GREEN : RED },
        { label: t.statLabels.profitFactor, value: pf === null ? '—' : (pf === Infinity ? '∞' : pf.toFixed(2)), color: WHITE },
        { label: t.statLabels.avgWin, value: usd(extra.avgWin, true), color: GREEN },
        { label: t.statLabels.avgLoss, value: usd(extra.avgLoss, true), color: RED },
        { label: t.statLabels.maxDrawdown, value: extra.maxDrawdown === null ? '—' : pct(extra.maxDrawdown), color: RED },
        { label: t.statLabels.bestTrade, value: usd(s.best_trade_pnl, true), color: GREEN }
    ];

    $('stats-grid').innerHTML = cards.map((c) => `
        <div class="stat">
            <div class="stat-label">${escapeHtml(c.label)}</div>
            <div class="stat-value" style="color:${c.color}">${escapeHtml(c.value)}</div>
        </div>
    `).join('');
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
        const pnlP = num(p.pnl_pct);
        const pnlColor = pnlP >= 0 ? GREEN : RED;
        return `
            <div class="pos-row">
                <div class="pos-pair">${escapeHtml(formatPair(p.symbol))}</div>
                <div style="color:${isLong ? GREEN : RED}">[${side}]</div>
                <div class="pos-entry">${escapeHtml(p.entry_price ?? '—')}</div>
                <div class="pos-pnl r" style="color:${pnlColor}">${pnlP === null ? '—' : pct(pnlP)}</div>
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
