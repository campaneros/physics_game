// Sorgenti React in src/, output in www/ (webDir di Capacitor). Il motore e i vecchi moduli UI restano in www/ come script classici.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'src',
  base: './',
  plugins: [react()],
  build: {
    outDir: '../www',
    emptyOutDir: false, // www/ contiene anche motore, icone e service worker
    assetsInlineLimit: 0, // la CSP vieta data: URI
    modulePreload: false, // niente script inline di preload
    sourcemap: false,
    rollupOptions: {
      output: { entryFileNames: 'assets/app.js', chunkFileNames: 'assets/[name].js', assetFileNames: 'assets/[name][extname]' },
    },
  },
});
