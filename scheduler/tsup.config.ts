import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['scheduler/server.ts'],
  format: ['cjs'],
  target: 'node18',
  tsconfig: './scheduler/tsconfig.json',
  outDir: './build/scheduler',
  clean: true,
  sourcemap: true,
  minify: false,
  splitting: false,
  bundle: true,
  external: [
    '@prisma/client',
    'prisma'
  ],
});
