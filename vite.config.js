import { defineConfig } from 'vite';

export default defineConfig({
    server: {
        proxy: {
            // These endpoints require the /api prefix on the backend
            '/api': {
                target: 'https://vidget.coinheim.io',
                changeOrigin: true
            },
            // These endpoints are at the root on the backend
            '/klines': {
                target: 'https://vidget.coinheim.io',
                changeOrigin: true
            },
            '/assets': {
                target: 'https://vidget.coinheim.io',
                changeOrigin: true
            },
            '/news': {
                target: 'https://vidget.coinheim.io',
                changeOrigin: true
            },
            '/analytics': {
                target: 'https://vidget.coinheim.io',
                changeOrigin: true
            },
            '/market-stats': {
                target: 'https://vidget.coinheim.io',
                changeOrigin: true
            },
            '/market-forecast': {
                target: 'https://vidget.coinheim.io',
                changeOrigin: true
            },
            '/crypto-analysis': {
                target: 'https://vidget.coinheim.io',
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
