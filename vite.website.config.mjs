import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  root: resolve('website-react'),
  publicDir: false,
  plugins: [react()],
  build: {
    outDir: resolve('dist-website'),
    emptyOutDir: true,
    sourcemap: true,
  },
});
