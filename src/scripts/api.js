// In production (e.g. GitHub Pages), it directly calls the backend.
// Note: Backend MUST have CORS configured to allow the frontend origin.
const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const BASE_URL = isLocal ? "/api" : "http://34.78.2.164";

/**
 * Common fetch utility with Accept-Language header
 */
async function fetchApi(endpoint) {
    const language = navigator.language || "en";
    try {
        const response = await fetch(`${BASE_URL}${endpoint}`, {
            headers: {
                "Accept-Language": language
            }
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (e) {
        console.error(`Fetch API Error for ${endpoint}:`, e);
        return null;
    }
}

export const API = {
    getAssets: () => fetchApi("/assets"),
    getSparklines: () => fetchApi("/klines/sparklines"),
    getLatestNews: () => fetchApi("/news/latest"),
    getMarketScan: () => fetchApi("/analytics/market-scan"),
    getFearGreedIndex: () => fetchApi("/market-stats/fear-greed-index"),
    getAltcoinSeasonIndex: () => fetchApi("/market-stats/altcoin-season"),
    getDominanceStreamgraph: () => fetchApi("/market-stats/dominance-streamgraph"),
    getTetherDominance: (timeframe = "90d") => fetchApi(`/market-stats/tether-dominance?timeframe=${timeframe}`),
    getMarketStats: () => fetchApi("/market-stats"),
    getMarketStatChart: (statId, limit = 30) => fetchApi(`/market-stats/${statId}/chart?limit=${limit}`),
    getMarketForecast: (lang = 'en') => fetchApi(`/market-forecast?lang=${lang}`)
};
