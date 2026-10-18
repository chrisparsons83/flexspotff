// Runs `npm run typecheck` when Claude finishes a turn that changed
// TypeScript. Errors block the stop so Claude fixes them first.
import { execSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const input = JSON.parse(readFileSync(0, 'utf8'));
// Already sent back once for type errors; don't loop forever.
if (input.stop_hook_active) process.exit(0);

const cwd = process.env.CLAUDE_PROJECT_DIR;
const changed = execSync('git status --porcelain', { cwd, encoding: 'utf8' });
if (!/\.tsx?$/m.test(changed)) process.exit(0);

const result = spawnSync('npm', ['run', '-s', 'typecheck'], {
  cwd,
  encoding: 'utf8',
});
if (result.status !== 0) {
  process.stderr.write(
    `Typecheck failed. Fix these errors:\n${result.stdout}${result.stderr}`,
  );
  process.exit(2);
}
