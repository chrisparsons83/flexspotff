import { join } from 'path';
import { defineConfig } from 'vite';

/** The app's aliases without the Remix plugin. PostCSS runs Tailwind. */
export default defineConfig({
  resolve: {
    alias: {
      '~': join(__dirname, '..', 'app'),
    },
  },
  // The stories import only React's types, and the JSX runtime is added after
  // Vite's dependency scan, so the scan misses React and dev serves its
  // CommonJS build raw, which breaks every story. Pre-bundle it up front.
  optimizeDeps: {
    include: [
      'react',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'react-dom',
    ],
  },
});
