# Local environment

Gotchas for running this repo in a sandboxed agent workspace. They cost real
time when rediscovered; nothing here is project behaviour.

## Git writes fail with `index.lock: Permission denied`

The session workspace may be a linked worktree whose git directory lives outside
the writable area. When `git add`/`commit`/`worktree` fails that way, clone the
repository into the workspace and do the work there:

```bash
git clone --quiet /path/to/checkout work
cd work
git remote set-url origin git@github.com:chrisparsons83/flexspotff.git
```

The clone's `.git` is inside the workspace, so every git command works. Push the
branch from the clone and open the PR there; leave the outer checkout untouched.

## Typecheck is wrong until the Prisma client matches the branch

`node_modules` can carry a client generated from another branch's schema (a
discarded attempt, or a worktree copied after a schema change). `tsc -b` then
reports fields that do not exist and misses ones that do. Run:

```bash
npm run preflight   # prisma generate && tsc -b
```

before trusting any typecheck, and after every schema change.

## Ticket worktrees

Keep them outside the repository where the sandbox allows it. If they must live
inside (`.worktrees/`, gitignored), `.eslintrc.cjs` sets `root: true`, so ESLint
stops at that config rather than also loading the parent checkout's. If a plugin
uniqueness error still appears, a second `node_modules` is visible; pin the
config:

```bash
npx eslint --no-eslintrc --config .eslintrc.cjs <files>
```

## Verification

`npm run validate` mirrors the checks CI can run without Docker: tests, lint,
typecheck, format and `check:patterns`. The Storybook and migration-drift jobs
need their own setup; every check lives in `.github/workflows/deploy.yml`.
