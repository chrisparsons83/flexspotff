import { vitePlugin as remix } from '@remix-run/dev';
import { join } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      '~': join(__dirname, 'app'),
    },
  },
  plugins: [
    remix({
      ignoredRouteFiles: ['**/*.css', '**/*.test.{js,jsx,ts,tsx}'],
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
      },
    }),
  ],
});
