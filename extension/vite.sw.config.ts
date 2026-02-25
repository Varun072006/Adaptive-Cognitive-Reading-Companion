import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    build: {
        outDir: 'dist',
        emptyOutDir: false,
        lib: {
            entry: resolve(__dirname, 'src/background/service-worker.ts'),
            name: 'ACRCBackground',
            formats: ['es'], // service-worker.js must be 'type': 'module' in manifest or use IIFE. We use flattened ES.
            fileName: () => 'service-worker.js',
        },
        rollupOptions: {
            output: {
                inlineDynamicImports: true,
            }
        }
    },
    define: {
        'process.env': {}
    }
});
