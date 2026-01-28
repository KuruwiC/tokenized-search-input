import { cpSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import dts from 'vite-plugin-dts';

function copyStyles(): Plugin {
  return {
    name: 'copy-styles',
    closeBundle() {
      cpSync(resolve(__dirname, 'src/index.css'), resolve(__dirname, 'dist/index.css'));
      writeFileSync(resolve(__dirname, 'dist/index.css.d.ts'), 'export {};\n');
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    dts({
      insertTypesEntry: true,
    }),
    copyStyles(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        utils: resolve(__dirname, 'src/utils.ts'),
        internal: resolve(__dirname, 'src/internal.ts'),
      },
      name: 'TokenizedSearch',
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => `${entryName}.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react/jsx-runtime': 'jsxRuntime',
        },
        banner: (chunk) => {
          if (chunk.isEntry && (chunk.name === 'index' || chunk.name === 'internal')) {
            return '"use client";\n';
          }
          return '';
        },
      },
    },
    copyPublicDir: false,
  },
});
