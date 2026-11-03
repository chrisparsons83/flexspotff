// Runs `npm run typecheck` when Claude finishes a turn that changed
// TypeScript. Errors block the stop so Claude fixes them first.
import { execSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const input = JSON.parse(readFileSync(0, 'utf8'));
// Already sent back once for type errors; don't loop forever.
if (input.stop_hook_active) process.exit(0);

const cwd = process.env.CLAUDE_PROJECT_DIR;
const changed = execSync('git status --porcelain -uall', {
  cwd,
  encoding: 'utf8',
});
if (!/\.tsx?$/m.test(changed)) process.exit(0);

const result = spawnSync('npm', ['run', '-s', 'typecheck'], {
  cwd,
  encoding: 'utf8',
});
if (result.status !== 0) {
  // A branch switch can leave node_modules behind package.json, and then every
  // file importing a new package fails - errors no code change can fix.
  const pkg = JSON.parse(readFileSync(path.join(cwd, 'package.json'), 'utf8'));
  const declared = { ...pkg.dependencies, ...pkg.devDependencies };
  const missing = [
    ...new Set(
      [...result.stdout.matchAll(/TS2307: Cannot find module '([^']+)'/g)]
        .map(([, specifier]) =>
          specifier
            .split('/')
            .slice(0, specifier.startsWith('@') ? 2 : 1)
            .join('/'),
        )
        .filter(
          name =>
            name in declared &&
            !existsSync(path.join(cwd, 'node_modules', name)),
        ),
    ),
  ];
  if (missing.length > 0) {
    process.stderr.write(
      `Typecheck failed because installed packages are out of date (missing ${missing.join(
        ', ',
      )}). Run \`npm ci\`, then typecheck again.\n`,
    );
    process.exit(2);
  }

  process.stderr.write(
    `Typecheck failed. Fix these errors:\n${result.stdout}${result.stderr}`,
  );
  process.exit(2);
}
