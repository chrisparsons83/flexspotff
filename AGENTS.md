## Agent skills

### Issue tracker

Issues live in GitHub Issues on chrisparsons83/flexspotff (via `gh`). Read one
with `gh issue view <n> --json title,body,comments,labels`; without `--json` it
fails. More in `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`,
`ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one root `GLOSSARY.md` plus `docs/adr/`. See
`docs/agents/domain.md`.
