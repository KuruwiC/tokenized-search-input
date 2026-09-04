import { copyFileSync, cpSync, readFileSync, writeFileSync } from 'node:fs';
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
      for (const entry of ['index', 'utils', 'internal']) {
        copyFileSync(
          resolve(__dirname, `dist/${entry}.d.ts`),
          resolve(__dirname, `dist/${entry}.d.cts`)
        );
      }
    },
  };
}

const packageManifest = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8')) as {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};
const externalPackages = [
  ...Object.keys(packageManifest.dependencies ?? {}),
  ...Object.keys(packageManifest.peerDependencies ?? {}),
];

function isExternalPackage(id: string): boolean {
  if (id.startsWith('.') || id.startsWith('/') || id.includes(':')) return false;
  return externalPackages.some((name) => id === name || id.startsWith(`${name}/`));
}

export default defineConfig({
  plugins: [
    react(),
    dts({
      insertTypesEntry: true,
      tsconfigPath: resolve(__dirname, 'tsconfig.build.json'),
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
      external: isExternalPackage,
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
