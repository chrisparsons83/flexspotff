import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../app/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-a11y', '@storybook/addon-themes'],
  framework: {
    name: '@storybook/react-vite',
    // The app's vite.config.ts runs the Remix plugin, which wants to own the
    // whole build, so Storybook gets a config of its own.
    options: { builder: { viteConfigPath: '.storybook/vite.config.ts' } },
  },
  // The logo files, fonts and favicons, at the paths the site serves them.
  staticDirs: ['../public'],
};

export default config;
