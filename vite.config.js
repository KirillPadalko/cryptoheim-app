import { defineConfig } from 'vite';

// Set this to your backend server URL.
// Use 'https://mesh-online.org' to target the remote production server.
// Use 'http://127.0.0.1:8000' to target a local backend server.
const PROXY_TARGET = 'https://mesh-online.org';

export default defineConfig({
    server: {
        proxy: {
            // These endpoints require the /api prefix on the backend
            '/api': {
                target: PROXY_TARGET,
                changeOrigin: true,
                secure: false
            },
            // These endpoints are at the root on the backend
            '/klines': {
                target: PROXY_TARGET,
                changeOrigin: true,
                secure: false
            },
            '/assets': {
                target: PROXY_TARGET,
                changeOrigin: true,
                secure: false
            },
            '/news': {
                target: PROXY_TARGET,
                changeOrigin: true,
                secure: false
            },
            '/analytics': {
                target: PROXY_TARGET,
                changeOrigin: true,
                secure: false
            },
            '/market-stats': {
                target: PROXY_TARGET,
                changeOrigin: true,
                secure: false
            },
            '/market-forecast': {
                target: PROXY_TARGET,
                changeOrigin: true,
                secure: false
            },
            '/model-quality': {
                target: PROXY_TARGET,
                changeOrigin: true,
                secure: false
            },
            '/crypto-analysis': {
                target: PROXY_TARGET,
                changeOrigin: true,
                secure: false
            }
        }
    },
    build: {
        rollupOptions: {
            input: {
                main: 'index.html',
                indicators: 'indicators.html'
            }
        }
    }
});
