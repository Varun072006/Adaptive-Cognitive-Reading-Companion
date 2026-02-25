import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    plugins: [react()],
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        cssCodeSplit: false, // Added this line
        rollupOptions: {
            input: {
                popup: resolve(__dirname, 'src/popup/popup.html'),
                content: resolve(__dirname, 'src/content/index.tsx'),
                loader: resolve(__dirname, 'src/content/loader.js'),
                'service-worker': resolve(__dirname, 'src/background/service-worker.ts'),
            },
            output: {
                entryFileNames: '[name].js',
                chunkFileNames: 'chunks/[name].js',
                assetFileNames: 'assets/[name].[ext]',
                manualChunks: {
                    vendor: ['react', 'react-dom'],
                },
            },
        },
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src'),
        },
    },
});
