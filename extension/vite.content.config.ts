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
                // Ensure CSS is handled if lib mode doesn't do it automatically
            }
        }
    },
    define: {
        'process.env': {}
    }
});
