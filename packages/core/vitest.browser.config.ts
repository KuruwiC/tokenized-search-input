import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

const mobileFile = 'src/__tests__/browser/mobile.test.tsx';

// Drive an input method through the DevTools protocol, which only Chromium has.
const chromiumOnlyFiles = ['src/__tests__/browser/ime-triggers.test.tsx'];

// Firefox runs the suites written to hold in every engine; the caret, pointer and composition
// suites assume Chromium and WebKit behaviour.
const crossEngineFiles = [
  'src/__tests__/browser/active-option-colour.test.tsx',
  'src/__tests__/browser/caret-anchors.test.tsx',
  'src/__tests__/browser/consumer-css.test.tsx',
  'src/__tests__/browser/container-shape.test.tsx',
  'src/__tests__/browser/edit-input-width.test.tsx',
  'src/__tests__/browser/expand-height.test.tsx',
  'src/__tests__/browser/focus-indicator.test.tsx',
  'src/__tests__/browser/popover-shape.test.tsx',
  'src/__tests__/browser/single-line-scroll.test.tsx',
  'src/__tests__/browser/suggestion-option-layout.test.tsx',
  'src/__tests__/browser/token-shape.test.tsx',
];

// There is no mobile device in CI. A mobile run is a desktop engine with a phone viewport,
// touch support and an Android Chrome user agent, on WebKit as well as Chromium so that both
// take the same user-agent dependent code paths and meet the same expectations.
const androidChrome =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36';

// Both viewports are shorter than the 720px browser window, so the test iframe is not scaled
// down and element-relative pointer positions land where the tests compute them.
const desktop = { width: 800, height: 600 };
const phone = { width: 375, height: 640 };

const mobileProvider = (userAgent: string) =>
  playwright({ contextOptions: { userAgent, hasTouch: true } });

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/__tests__/browser/**/*.test.{ts,tsx}'],
    browser: {
      enabled: true,
      headless: true,
      screenshotFailures: false,
      provider: playwright(),
      instances: [
        { browser: 'chromium', exclude: [mobileFile], viewport: desktop },
        { browser: 'webkit', exclude: [mobileFile, ...chromiumOnlyFiles], viewport: desktop },
        // Firefox focuses one window at a time and each test file runs in a window of its own, so
        // files run side by side take focus from each other and blur the editor under test.
        {
          browser: 'firefox',
          include: crossEngineFiles,
          viewport: desktop,
          fileParallelism: false,
        },
        {
          browser: 'chromium',
          name: 'chromium-mobile',
          include: [mobileFile],
          viewport: phone,
          provider: mobileProvider(androidChrome),
        },
        {
          browser: 'webkit',
          name: 'webkit-mobile',
          include: [mobileFile],
          viewport: phone,
          provider: mobileProvider(androidChrome),
        },
      ],
      commands: {
        // One insertion, as an input method commits text.
        insertText: async ({ page }, text: string) => {
          await page.keyboard.insertText(text);
        },
        // Needs a context created with touch support.
        tapEditor: async ({ iframe }, position: { x: number; y: number }) => {
          await iframe.locator('.ProseMirror').tap({ position });
        },
        pressMouse: async ({ page }) => {
          await page.mouse.down();
        },
        releaseMouse: async ({ page }) => {
          await page.mouse.up();
        },
      },
    },
  },
});
