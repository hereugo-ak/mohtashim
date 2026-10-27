import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    target: 'baseline-widely-available',
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
});
