import react from '@vitejs/plugin-react';
import { coverageConfigDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['src/__tests__/browser/**'],
    coverage: {
      provider: 'v8',
      exclude: [
        ...coverageConfigDefaults.exclude,
        'src/__tests__/**',
        // Barrel files that only re-export.
        'src/index.ts',
        'src/editor/hooks/index.ts',
        'src/editor/keyboard/index.ts',
        'src/editor/keyboard/strategies/index.ts',
        'src/helpers/index.ts',
        'src/keyboard/index.ts',
        'src/pickers/index.ts',
        'src/plugins/suggestion/index.ts',
        'src/plugins/token-spacing/helpers/index.ts',
        'src/tokens/composition/**/index.ts',
        'src/types/index.ts',
      ],
      reporter: ['text', 'html', 'json-summary'],
      thresholds: {
        statements: 65,
        branches: 55,
        functions: 70,
        lines: 67,
      },
    },
  },
});
