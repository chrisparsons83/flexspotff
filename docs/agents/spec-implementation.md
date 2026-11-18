# Implementing a spec

Delegation briefs for the orchestrator, so an implementer or merger subagent
gets pointers instead of a retyped environment. The orchestrator keeps the task
graph; every subagent works from its ticket, this repo's docs, and the
integration branch.

## Implementer

Give each ticket its own worktree and branch, based on the integration branch.
The brief:

1. Read the ticket (`gh issue view <n> --json title,body`), the parent spec, and
   `docs/adr/` and `GLOSSARY.md` where the ticket touches domain vocabulary.
2. Confirm the branch starts at the integration tip; reset onto it if not. Call
   the `tdd` skill for behaviour changes.
3. Implement only the ticket's scope, in the module structure the spec names.
   Merge the integration tip into the branch before reporting, resolving
   conflicts by keeping both sides' intent.
4. Verify with the focused test files, `npm run typecheck`, Prettier on changed
   files, and `npx eslint` (see `docs/agents/environment.md` if ESLint reports
   duplicate plugins).
5. Commit with an imperative subject and a body explaining why. Do not push, do
   not touch the integration branch.

The report is the commit sha, files changed, commands and results, and anything
the next ticket must hook into.

## Merger

One merger per ticket, on the integration branch:

1. Confirm the integration worktree is clean and on the integration branch.
2. `git merge --no-ff <ticket-branch> -m "<ticket title> (#<number>)"`; resolve
   conflicts keeping both sides, never rebase or squash.
3. Run the focused tests, `npm run typecheck`, Prettier and ESLint on the merged
   tree; regenerate the Prisma client when the schema changed.
4. Report the merge sha, whether it was clean, and the command results.

Do not push, touch `main`, or delete worktrees from a merger.
