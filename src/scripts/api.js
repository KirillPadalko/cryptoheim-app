const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const BASE_URL = isLocal ? "" : "https://mesh-online.org";

function getFullUrl(endpoint) {
    if (!BASE_URL) return endpoint;
    const base = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
    const path = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
    return base + path;
}

console.log(`[API] Host: ${window.location.hostname}, Mode: ${isLocal ? 'Local' : 'Production'}, Base: ${BASE_URL || '(local proxy)'}`);

/**
 * Common fetch utility with Accept-Language header
 */
async function fetchApi(endpoint) {
    const language = navigator.language || "en";
    const fullUrl = getFullUrl(endpoint);
    const token = localStorage.getItem('cryptoheim_token');
    try {
        const headers = { "Accept-Language": language };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const response = await fetch(fullUrl, { headers });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (e) {
        console.error(`Fetch API Error for ${fullUrl}:`, e);
        return null;
    }
}

async function postApi(endpoint, body) {
    const fullUrl = getFullUrl(endpoint);
    const token = localStorage.getItem('cryptoheim_token');
    try {
        const headers = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const response = await fetch(fullUrl, {
            method: "POST",
            headers: headers,
            body: JSON.stringify(body)
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (e) {
        console.error(`Post API Error for ${fullUrl}:`, e);
        return null;
    }
}

async function putApi(endpoint, body) {
    const fullUrl = getFullUrl(endpoint);
    const token = localStorage.getItem('cryptoheim_token');
    try {
        const headers = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const response = await fetch(fullUrl, {
            method: "PUT",
            headers: headers,
            body: JSON.stringify(body)
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (e) {
        console.error(`Put API Error for ${fullUrl}:`, e);
        return null;
    }
}

export const API = {
    getAssets: () => fetchApi("/assets"),
    getSparklines: () => fetchApi("/klines/sparklines"),
    getLatestNews: (lang = "ru") => fetchApi(`/news/latest?lang=${lang}`),
    getBotPositions: () => fetchApi("/api/trading/positions"),
    getBotStats: () => fetchApi("/api/trading/stats"),
    getBotHistory: (limit = 10) => fetchApi(`/api/trading/history?limit=${limit}`),
    getKlinesSummary: (symbols) => fetchApi(`/klines${symbols ? '?symbols='+symbols : ''}`),
    getKlinesForSymbol: (symbol, timeframe = "15m", limit = 500) => fetchApi(`/klines/${symbol}?timeframe=${timeframe}&limit=${limit}`),
    getMarketScan: () => fetchApi("/analytics/market-scan"),
    getFearGreedIndex: () => fetchApi("/market-stats/fear-greed-index"),
    getAltcoinSeasonIndex: () => fetchApi("/market-stats/altcoin-season"),
    getDominanceStreamgraph: () => fetchApi("/market-stats/dominance-streamgraph"),
    getTetherDominance: (timeframe = "90d") => fetchApi(`/market-stats/tether-dominance?timeframe=${timeframe}`),
    getMarketStats: () => fetchApi("/market-stats"),
    getMarketStatChart: (statId, limit = 30) => fetchApi(`/market-stats/${statId}/chart?limit=${limit}`),
    getMarketForecast: (lang = 'en') => fetchApi(`/market-forecast?lang=${lang}`),
    getCryptoAnalysis: (lang = 'en') => fetchApi(`/crypto-analysis?lang=${lang}`),
    
    // Expert Page
    getExpertCurrent: () => fetchApi("/api/expert/current"),
    getExpertHistory: (limit = 20) => fetchApi(`/api/expert/history?limit=${limit}`),
    getExpertStats: () => fetchApi("/api/expert/stats"),
    getLeaderboard: () => fetchApi("/api/expert/leaderboard"),
    submitExpertForecast: (side, reason, tp_price = null, sl_price = null, size = 100) => postApi("/api/expert/forecast", { side, reason, tp_price, sl_price, size }),
    closeExpertForecast: () => postApi("/api/expert/close", {}),

    // Auth & Profile
    authStart: (nickname) => postApi("/api/auth/start", { nickname }),
    authVerify: (nickname, code_or_password) => postApi("/api/auth/verify", { nickname, code_or_password }),
    getMe: () => fetchApi("/api/auth/me"),
    updateProfile: (data) => putApi("/api/auth/profile", data),
    
    logout: () => {
        localStorage.removeItem('cryptoheim_token');
        localStorage.removeItem('cryptoheim_user');
        window.location.reload();
    }
};
