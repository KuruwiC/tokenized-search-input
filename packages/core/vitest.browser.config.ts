import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/__tests__/browser/**/*.test.{ts,tsx}'],
    browser: {
      enabled: true,
      headless: true,
      screenshotFailures: false,
      provider: playwright(),
      instances: [{ browser: 'chromium' }, { browser: 'webkit' }],
      commands: {
        // Types text into the focused element the way an input method commits it: as a
        // single insertion, not as key presses. Works on every engine.
        insertText: async ({ page }, text: string) => {
          await page.keyboard.insertText(text);
        },
      },
    },
  },
});
