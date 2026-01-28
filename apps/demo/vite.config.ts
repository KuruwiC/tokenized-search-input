import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: { conditions: ['source'] },
  base: process.env.DEMO_BASE ?? '/',
  build: { outDir: 'dist', emptyOutDir: true },
});
