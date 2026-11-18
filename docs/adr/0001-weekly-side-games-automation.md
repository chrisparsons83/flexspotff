# Weekly side games run themselves until an admin takes one over

The weekly side games used to need an admin to create, publish and score every
week by hand; the only automatic step was QB Streaming opening on Wednesday
morning. Locks Challenge and Spread Pool now open themselves at 8am Eastern on
the Tuesday before the week's first kickoff, and all four side games — QB
Streaming, Spread Pool, Locks Challenge and DFS Survivor — are scored once every
NFL game of the week is complete. The automation covers weeks 1 to 17 and never
opens or scores week 18. On Locks Challenge and Spread Pool, any admin action on
a week (creating, opening, closing or scoring it) ends the automation's
involvement with that week, so a week handed to a human stays human-owned. DFS
Survivor has no such marker: a scored week is its ownership signal, and a DFS
Survivor week an admin reverts may later be scored again, by hand or by the
automation, because recomputing from current stats is the point.

## Considered options

- **Let the automation reopen any closed week.** It would have fought an admin
  who closed a week deliberately, within four hours. The QB Streaming sync
  already refuses to reopen a week an admin closed, so this would have made the
  other three inconsistent with the one that shipped first.
- **Backfill every unscored week after an outage.** It would resurface a week
  abandoned in September, and for the Spread Pool write missed-week penalties
  for it. Scoring only the current NFL week and the one before means a missed
  Monday heals for a week, and older weeks stay a manual job.
- **Poll for scoring all week.** Scoring cannot happen until the week's last
  game is complete, and the schedule shows that is always Monday night Pacific —
  every week 1 to 17 in 2024–2026 ends there. Polling the rest of the week buys
  nothing.
- **Run to week 18, as the NFL does.** The site's fantasy season ends at
  week 17. Pool and QB Streaming have never had an 18th week; Locks once did
  (2024), which is the kind of drift the cap exists to stop.

## Consequences

- The Spread Pool opens only once every game of the week has a line. Until then
  it is retried on each run, one admin alert goes out on the first failed
  attempt, and the half-built week is visible on the admin page and nowhere else
  — members see only that the week's lines are not set.
- The opener syncs the NFL schedule for the coming week before opening it,
  because the full season only arrives through the manual "Resync NFL Games"
  button and an opening must not depend on someone having pressed it.
- An admin who needs a week held closed can close it and the automation will not
  reopen it; the cost is that the week is then theirs to open by hand.
