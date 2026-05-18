import { defineConfig } from 'vite';

export default defineConfig({
    server: {
        proxy: {
            // These endpoints require the /api prefix on the backend
            '/api': {
                target: 'http://127.0.0.1:8000',
                changeOrigin: true
            },
            // These endpoints are at the root on the backend
            '/klines': {
                target: 'http://127.0.0.1:8000',
                changeOrigin: true
            },
            '/assets': {
                target: 'http://127.0.0.1:8000',
                changeOrigin: true
            },
            '/news': {
                target: 'http://127.0.0.1:8000',
                changeOrigin: true
            },
            '/analytics': {
                target: 'http://127.0.0.1:8000',
                changeOrigin: true
            },
            '/market-stats': {
                target: 'http://127.0.0.1:8000',
                changeOrigin: true
            },
            '/market-forecast': {
                target: 'http://127.0.0.1:8000',
                changeOrigin: true
            },
            '/model-quality': {
                target: 'http://127.0.0.1:8000',
                changeOrigin: true
            },
            '/crypto-analysis': {
                target: 'http://127.0.0.1:8000',
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
