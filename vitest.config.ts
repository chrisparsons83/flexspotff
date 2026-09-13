/// <reference types="vitest" />
/// <reference types="vite/client" />
import { join } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Component tests need the automatic JSX runtime; without it a .tsx test
  // fails at import with "React is not defined".
  esbuild: {
    jsx: 'automatic',
  },
  resolve: {
    alias: {
      '~': join(__dirname, 'app'),
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./test/setup-test-env.ts'],
    include: ['./app/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    watchIgnore: [
      '.*\\/node_modules\\/.*',
      '.*\\/build\\/.*',
      '.*\\/postgres-data\\/.*',
    ],
  },
});
