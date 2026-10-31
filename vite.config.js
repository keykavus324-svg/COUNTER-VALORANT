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
        // keep the baked map data in its own chunk so the app shell loads first
        manualChunks(id) {
          if (id.includes('/src/data/maps/')) return 'maps';
          if (id.includes('/src/data/')) return 'gamedata';
          if (id.includes('node_modules/three')) return 'three';
          return undefined;
        },
      },
    },
  },
});
