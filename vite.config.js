import { defineConfig } from 'vite';

export default defineConfig({
    server: {
        proxy: {
            '/api': {
                target: 'https://mesh-online.org',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api/, '')
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
