import { defineConfig } from 'vite';

export default defineConfig({
    server: {
        proxy: {
            // These endpoints require the /api prefix on the backend
            '/api': {
                target: 'https://mesh-online.org',
                changeOrigin: true
            },
            // These endpoints are at the root on the backend
            '/klines': {
                target: 'https://mesh-online.org',
                changeOrigin: true
            },
            '/assets': {
                target: 'https://mesh-online.org',
                changeOrigin: true
            },
            '/news': {
                target: 'https://mesh-online.org',
                changeOrigin: true
            },
            '/analytics': {
                target: 'https://mesh-online.org',
                changeOrigin: true
            },
            '/market-stats': {
                target: 'https://mesh-online.org',
                changeOrigin: true
            },
            '/market-forecast': {
                target: 'https://mesh-online.org',
                changeOrigin: true
            },
            '/model-quality': {
                target: 'https://mesh-online.org',
                changeOrigin: true
            },
            '/crypto-analysis': {
                target: 'https://mesh-online.org',
                changeOrigin: true
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
