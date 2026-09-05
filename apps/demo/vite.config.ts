import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: { conditions: ['source'] },
  base: process.env.DEMO_BASE ?? '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/prism-react-renderer')) return 'syntax-highlighting';
          if (id.includes('node_modules/@tiptap') || id.includes('node_modules/prosemirror')) {
            return 'editor';
          }
          if (id.includes('node_modules/lucide-react')) return 'icons';
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/scheduler/')
          ) {
            return 'react';
          }
          return undefined;
        },
      },
    },
  },
});
