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
        'src/editor/keyboard/index.ts',
        'src/editor/keyboard/strategies/index.ts',
        'src/plugins/suggestion/index.ts',
        'src/tokens/composition/**/index.ts',
        'src/types/index.ts',
      ],
      reporter: ['text', 'html', 'json-summary'],
      thresholds: {
        statements: 85,
        branches: 80,
        functions: 91,
        lines: 87,
      },
    },
  },
});
