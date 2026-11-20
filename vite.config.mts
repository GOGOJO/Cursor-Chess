import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

const __dirname = import.meta.dirname;

// Output names are fixed (no hashes) because the extension references them directly in the webview HTML.
export default defineConfig({
  root: resolve(__dirname, 'src/webview'),
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: resolve(__dirname, 'dist/webview'),
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/index.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
});
