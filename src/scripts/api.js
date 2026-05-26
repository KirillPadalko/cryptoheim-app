const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const BASE_URL = ""; // Use relative paths for seamless dev/prod integration


function getDeviceId() {
    let deviceId = localStorage.getItem('cryptoheim_device_id');
    if (!deviceId) {
        deviceId = 'web-' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('cryptoheim_device_id', deviceId);
    }
    return deviceId;
}

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
        const headers = { 
            "Accept-Language": language,
            "X-Device-ID": getDeviceId()
        };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const response = await fetch(fullUrl, { headers });
        if (!response.ok) {
            if (response.status === 401) {
                console.warn("[API] 401 Unauthorized detected. Clearing expired token.");
                localStorage.removeItem('cryptoheim_token');
                localStorage.removeItem('cryptoheim_user');
                return { status: 'error', code: 401, message: 'Unauthorized / Session Expired' };
            }
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
        const headers = { 
            "Content-Type": "application/json",
            "X-Device-ID": getDeviceId()
        };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const response = await fetch(fullUrl, {
            method: "POST",
            headers: headers,
            body: JSON.stringify(body)
        });
        if (!response.ok) {
            if (response.status === 401) {
                console.warn("[API] 401 Unauthorized detected. Clearing expired token.");
                localStorage.removeItem('cryptoheim_token');
                localStorage.removeItem('cryptoheim_user');
                return { status: 'error', code: 401, message: 'Unauthorized / Session Expired' };
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
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
        const headers = { 
            "Content-Type": "application/json",
            "X-Device-ID": getDeviceId()
        };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const response = await fetch(fullUrl, {
            method: "PUT",
            headers: headers,
            body: JSON.stringify(body)
        });
        if (!response.ok) {
            if (response.status === 401) {
                console.warn("[API] 401 Unauthorized detected. Clearing expired token.");
                localStorage.removeItem('cryptoheim_token');
                localStorage.removeItem('cryptoheim_user');
                return { status: 'error', code: 401, message: 'Unauthorized / Session Expired' };
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
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
    getVisitorStats: () => fetchApi("/analytics/visitor-stats"),
    
    // Expert Page
    getExpertCurrent: (nickname = "") => fetchApi(`/api/expert/current${nickname ? '?nickname='+nickname : ''}`),
    getExpertHistory: (limit = 20, nickname = "") => fetchApi(`/api/expert/history?limit=${limit}${nickname ? '&nickname='+nickname : ''}`),
    getExpertStats: () => fetchApi("/api/expert/stats"),
    getLeaderboard: () => fetchApi("/api/expert/leaderboard"),
    submitExpertForecast: (side, reason, tp_price = null, sl_price = null, size = 100) => postApi("/api/expert/forecast", { side, reason, tp_price, sl_price, size }),
    closeExpertForecast: () => postApi("/api/expert/close", {}),
    updateExpertForecast: (tp_price = null, sl_price = null) => postApi("/api/expert/update-tpsl", { tp_price, sl_price }),


    // Auth & Profile
    authStart: (nickname) => postApi("/api/auth/start", { nickname }),
    authVerify: (nickname, code_or_password) => postApi("/api/auth/verify", { nickname, code_or_password }),
    getMe: () => fetchApi("/api/auth/me"),
    updateProfile: (data) => putApi("/api/auth/profile", data),
    
    updateNavProfile: () => {
        const userJson = localStorage.getItem('cryptoheim_user');
        if (!userJson) return;
        try {
            const user = JSON.parse(userJson);
            const nickname = user.boosty_nickname;
            if (!nickname) return;

            const profileBtn = document.querySelector('.top-nav .profile-btn');
            if (!profileBtn) return;

            let container = profileBtn.parentElement;
            if (!container.classList.contains('nav-profile-container')) {
                container = document.createElement('div');
                container.className = 'nav-profile-container';
                profileBtn.parentNode.insertBefore(container, profileBtn);
                container.appendChild(profileBtn);
            }

            const existingSpan = container.querySelector('.nav-profile-username');
            if (existingSpan) existingSpan.remove();

            const span = document.createElement('span');
            span.className = 'nav-profile-username';
            span.textContent = nickname;
            container.appendChild(span);
        } catch(e) {
            console.error("Error updating nav profile:", e);
        }
    },
    
    refreshUserSession: async () => {
        const token = localStorage.getItem('cryptoheim_token');
        if (!token) return;
        try {
            const user = await API.getMe();
            if (user && user.boosty_nickname) {
                localStorage.setItem('cryptoheim_user', JSON.stringify(user));
                API.updateNavProfile();
            }
        } catch (e) {
            console.error("Error refreshing user session:", e);
        }
    },
    
    logout: () => {
        localStorage.removeItem('cryptoheim_token');
        localStorage.removeItem('cryptoheim_user');
        window.location.reload();
    }
};
