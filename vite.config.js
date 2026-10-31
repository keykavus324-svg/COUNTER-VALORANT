import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    allowedHosts: true,
  },
  preview: { host: '0.0.0.0', allowedHosts: true },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      output: {
        // Baked map tables must stay in per-map chunks: each arena is a dynamic
        // import, so returning undefined here keeps Rollup's own code splitting
        // (grouping all of them under one name would load every map at boot).
        manualChunks(id) {
          if (id.includes('/src/data/maps/')) return undefined;
          if (id.includes('/src/data/')) return 'gamedata';
          if (id.includes('node_modules/three')) return 'three';
          return undefined;
        },
      },
    },
  },
});
