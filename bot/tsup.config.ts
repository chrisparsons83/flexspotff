import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['bot/server.ts', 'bot/commands/*'],
  shims: true,
  format: ['cjs'],
  tsconfig: './bot/tsconfig.json',
  outDir: './build/bot',
});
