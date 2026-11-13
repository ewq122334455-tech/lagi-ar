import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Test builds only (RT_MOCK=1): swap the Decart SDK for a local double. Never set for the published site.
      ...(process.env.RT_MOCK === '1' ? { '@decartai/sdk': fileURLToPath(new URL('./src/test/decartMock.ts', import.meta.url)) } : {}),
    },
  },
  base: './',
  server: {
    host: true,
    port: 5173,
  },
  build: {
    outDir: 'dist',
    // No source maps in the published site (they exposed the full source). Debug builds can
    // still make them: `npx vite build --sourcemap`.
    sourcemap: false,
    chunkSizeWarningLimit: 1600,
  },
});
