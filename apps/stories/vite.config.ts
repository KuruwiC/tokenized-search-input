import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^@kuruwic\/tokenized-search-input$/,
        replacement: resolve(__dirname, '../../packages/core/src/index.ts'),
      },
      {
        find: /^@kuruwic\/tokenized-search-input\/utils$/,
        replacement: resolve(__dirname, '../../packages/core/src/utils.ts'),
      },
      {
        find: /^@kuruwic\/tokenized-search-input\/styles$/,
        replacement: resolve(__dirname, '../../packages/core/src/index.css'),
      },
    ],
  },
});
