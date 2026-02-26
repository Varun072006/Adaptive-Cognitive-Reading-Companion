import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
    plugins: [react()],
    build: {
        outDir: 'dist',
        emptyOutDir: false, // Don't clear dist, we need the other build output
        cssCodeSplit: false,
        lib: {
            entry: resolve(__dirname, 'src/content/index.tsx'),
            name: 'ACRCContent',
            formats: ['iife'],
            fileName: () => 'content.js',
        },
        rollupOptions: {
            output: {
                extend: true,
                // CSS will be inlined via ?inline import for Shadow DOM
                assetFileNames: 'content.[ext]',
            }
        },
        // Inline CSS into JS for Shadow DOM injection
        cssMinify: true,
    },
    css: {
        // Allow ?inline imports to return CSS as string
        modules: {
            localsConvention: 'camelCase',
        },
    },
    define: {
        'process.env': {}
    }
});
