import { defineConfig } from 'vite';

// GitHub Pages serves the site at /orrery/. Dev serves from the root; build and preview use the subpath.
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/orrery/' : '/',
  server: { port: 5174, strictPort: true },
  build: { target: 'es2022', outDir: 'dist', chunkSizeWarningLimit: 600 },
}));
