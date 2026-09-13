import { SCHEDULED_JOB_ENTRIES } from '../app/utils/jobs';
import { existsSync } from 'node:fs';
import { defineConfig } from 'tsup';

// Derived from the job registry so a newly scheduled job can't be left out of
// the build. Bree throws if any registered job's file is missing, which takes
// down every job, not just the new one.
//
// tsup silently drops an entry that doesn't exist, which would reintroduce the
// exact gap the registry is meant to close, so fail the build here instead.
const missing = SCHEDULED_JOB_ENTRIES.filter(entry => !existsSync(entry));
if (missing.length > 0) {
  throw new Error(
    `Scheduled jobs in app/utils/jobs.ts have no matching file: ${missing.join(
      ', ',
    )}`,
  );
}

export default defineConfig({
  entry: [...SCHEDULED_JOB_ENTRIES],
  format: ['cjs'],
  target: 'node18',
  outDir: './build/jobs',
  clean: true,
  sourcemap: true,
  minify: false,
  splitting: false,
  bundle: true,
  external: ['@prisma/client', 'prisma'],
  // Use .cjs extension for CommonJS in ESM project
  outExtension: () => ({ js: '.cjs' }),
});
