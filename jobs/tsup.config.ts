import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'jobs/sync-nfl-players.ts',
    'jobs/sync-leagues.ts',
    'jobs/monitor-nfl-games.ts',
  ],
  format: ['cjs'],
  target: 'node18',
  outDir: './build/jobs',
  clean: true,
  sourcemap: true,
  minify: false,
  splitting: false,
  bundle: true,
  external: [
    '@prisma/client',
    'prisma'
  ],
  // Keep the original file structure
  outExtension: () => ({ js: '.js' }),
});
