import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

/**
 * Points git at the checked-in hooks. Wired through npm's `prepare`, so any
 * install (a developer's clone, an agent's workspace) gets the same hook, not
 * just the Claude Code integration.
 *
 * A Docker build context has package.json but no repository, and a sandboxed
 * checkout may have a read-only git directory: both must install fine without
 * hooks rather than fail the install.
 */
if (!existsSync('.git')) process.exit(0);

try {
  execFileSync('git', ['config', 'core.hooksPath', '.githooks'], {
    stdio: 'ignore',
  });
} catch {
  // Best effort: formatting is still enforced by the CI format job.
}
