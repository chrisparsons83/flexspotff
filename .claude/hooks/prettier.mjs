// Formats the file Claude just edited. Files prettier can't parse or
// .prettierignore excludes are skipped.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const input = JSON.parse(readFileSync(0, 'utf8'));
const filePath = input.tool_input?.file_path;
if (!filePath) process.exit(0);

const result = spawnSync(
  'npx',
  ['prettier', '--write', '--ignore-unknown', filePath],
  { cwd: process.env.CLAUDE_PROJECT_DIR, encoding: 'utf8' },
);
if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout);
}
