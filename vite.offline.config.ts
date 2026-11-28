/**
 * OFFLINE BUILD — the whole site as plain files that open by double-clicking dist-offline/index.html (no server, no internet).
 *   npm run build:offline
 * Differences from the normal build: one classic (non-module) script, no dynamic chunks, no crossorigin attributes, fonts and
 * product data bundled (see scripts/make-offline.mjs). The normal build and the published site are untouched.
 */
import { defineConfig, mergeConfig } from 'vite';
import base from './vite.config';

export default mergeConfig(
  base,
  defineConfig({
    base: './',
    build: {
      outDir: 'dist-offline',
      emptyOutDir: true,
      modulePreload: false,
      cssCodeSplit: false,
      rollupOptions: { output: { format: 'iife', inlineDynamicImports: true, entryFileNames: 'assets/app.js', assetFileNames: 'assets/[name][extname]' } },
    },
  }),
);
