import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
    root: 'src/app',
    base: '/app/',
    plugins: [react(), tailwindcss()],
    build: {
        outDir: '../../dist/app',
        emptyOutDir: true,
    },
    server: {
        proxy: {
            '/api': 'http://localhost:8787',
        },
    },
});
