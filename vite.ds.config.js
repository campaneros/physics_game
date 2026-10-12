// Vetrina del design system, fuori da www/: `npm run ds` genera .ds-preview/ds.html (ignorata da git).
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'src',
  base: './',
  plugins: [react()],
  build: { outDir: '../.ds-preview', emptyOutDir: true, assetsInlineLimit: 0, modulePreload: false, rollupOptions: { input: 'src/ds.html' } },
});
