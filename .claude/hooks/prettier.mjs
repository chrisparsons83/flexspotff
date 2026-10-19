// Formats the file Claude just edited. Files outside the repo, files
// prettier can't parse and files .prettierignore excludes are skipped.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { relative, isAbsolute } from 'node:path';

const input = JSON.parse(readFileSync(0, 'utf8'));
const filePath = input.tool_input?.file_path;
if (!filePath) process.exit(0);

const projectDir = process.env.CLAUDE_PROJECT_DIR;
const rel = relative(projectDir, filePath);
if (rel.startsWith('..') || isAbsolute(rel)) process.exit(0);

const result = spawnSync(
  'npx',
  ['prettier', '--write', '--ignore-unknown', filePath],
  { cwd: projectDir, encoding: 'utf8' },
);
if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout);
}
