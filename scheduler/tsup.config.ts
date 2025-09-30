import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['server.ts'],
  format: ['cjs'],
  target: 'node18',
  outDir: '../build/scheduler',
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
