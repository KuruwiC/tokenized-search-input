import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/__tests__/browser/**/*.test.{ts,tsx}'],
    browser: {
      enabled: true,
      provider: playwright({ launch: { headless: true } }),
      instances: [{ browser: 'chromium' }],
    },
  },
});
