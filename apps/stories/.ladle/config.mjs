/** @type {import('@ladle/react').UserConfig} */
export default {
  stories: 'stories/**/*.stories.{js,jsx,ts,tsx}',
  viteConfig: './vite.config.ts',
  defaultStory: 'introduction--docs',
  addons: {
    theme: {
      enabled: true,
      defaultState: 'auto',
    },
  },
  storyOrder: [
    'introduction--*',
    'getting-started--*',
    'core-*',
    'features-*',
    'customization-*',
    'api-*',
    'advanced-*',
    'debug-*',
    'playground--*',
  ],
};
