import { join } from 'path';
import { defineConfig } from 'vite';

/** The app's aliases without the Remix plugin. PostCSS runs Tailwind. */
export default defineConfig({
  resolve: {
    alias: {
      '~': join(__dirname, '..', 'app'),
    },
  },
});
