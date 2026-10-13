import type { GuillotineFormat } from '@prisma/client';

/**
 * Week 17 is the final: the last two teams play it and the lower score is
 * chopped. Nothing after it counts - the 2021 league even shows every roster
 * scoring again in week 18.
 */
export const GUILLOTINE_FINAL_WEEK = 17;

export type ChopRoster = {
  rosterId: number;
  /** Sleeper's `settings.eliminated`, which only native leagues set. */
  eliminated: number | null;
  /** Whether the roster holds any players now. */
  hasPlayers: boolean;
};

export type ChopWeekRow = {
  rosterId: number;
  points: number;
  playerCount: number;
};

export type ChopResult = {
  /** Roster ID -> the week it was chopped, or null while it is alive. */
  choppedWeek: Map<number, number | null>;
  /** Roster ID -> final place, 1 being the champion. Unset until settled. */
  finish: Map<number, number>;
  championRosterId: number | null;
  /** Things the data could not settle, for the admin to look at. */
  warnings: string[];
};

/**
 * Reads who was chopped, and when, from what Sleeper recorded.
 *
 * - Native leagues carry the chop week on the roster (`eliminated`).
 * - Manual leagues have none: the commissioner emptied the roster instead, so
 *   a roster that is empty now was chopped in the last week it had players.
 *
 * Neither works out who *should* have gone. In both manual leagues checked,
 * the emptied roster was the week's lowest scorer every week, but the site
 * shows what happened in Sleeper, not what the rules say.
 *
 * The final is the one exception, because the manual leagues never emptied
 * either finalist: once week 17 is scored, the lower of the last two scores is
 * chopped in week 17 and the other team is champion.
 *
 * @param weeks - week -> that week's matchup rows, for every week Sleeper has
 * finished scoring and any week in progress.
 * @param lastScoredWeek - the last week Sleeper has finished scoring.
 */
export function resolveChops({
  format,
  rosters,
  weeks,
  lastScoredWeek,
}: {
  format: GuillotineFormat;
  rosters: ChopRoster[];
  weeks: Map<number, ChopWeekRow[]>;
  lastScoredWeek: number;
}): ChopResult {
  const warnings: string[] = [];
  const choppedWeek = new Map<number, number | null>();
  const scoredThrough = Math.min(lastScoredWeek, GUILLOTINE_FINAL_WEEK);

  for (const roster of rosters) {
    if (format === 'NATIVE') {
      const week = roster.eliminated;
      choppedWeek.set(
        roster.rosterId,
        week && week > 0 && week <= GUILLOTINE_FINAL_WEEK ? week : null,
      );
      continue;
    }

    if (roster.hasPlayers) {
      choppedWeek.set(roster.rosterId, null);
      continue;
    }

    // Every week we have, not just the finished ones: a commissioner can empty
    // the roster before Sleeper marks the week scored, and stopping at the
    // last scored week would then date the chop a week early.
    let lastWeekWithPlayers: number | null = null;
    for (let week = 1; week <= GUILLOTINE_FINAL_WEEK; week++) {
      const row = weeks.get(week)?.find(r => r.rosterId === roster.rosterId);
      if (row && row.playerCount > 0) lastWeekWithPlayers = week;
    }

    if (lastWeekWithPlayers === null) {
      // An empty roster that never played is not a chop we can date.
      warnings.push(
        `Roster ${roster.rosterId} is empty but never had players in a scored week, so it has no chop week.`,
      );
    }
    choppedWeek.set(roster.rosterId, lastWeekWithPlayers);
  }

  // The final. Native leagues may already have recorded it; if not, settle it
  // from week 17's scores the same way for both formats.
  let alive = rosters.filter(r => choppedWeek.get(r.rosterId) === null);
  if (scoredThrough >= GUILLOTINE_FINAL_WEEK && alive.length === 2) {
    const finalRows = weeks.get(GUILLOTINE_FINAL_WEEK) ?? [];
    const [a, b] = alive.map(roster => ({
      rosterId: roster.rosterId,
      points: finalRows.find(r => r.rosterId === roster.rosterId)?.points,
    }));
    if (a.points === undefined || b.points === undefined) {
      warnings.push(
        `Week ${GUILLOTINE_FINAL_WEEK} has no score for roster ${
          a.points === undefined ? a.rosterId : b.rosterId
        }, so the final could not be settled.`,
      );
    } else if (a.points === b.points) {
      warnings.push(
        `The week ${GUILLOTINE_FINAL_WEEK} final between rosters ${a.rosterId} and ${b.rosterId} is tied at ${a.points}, so there is no champion yet.`,
      );
    } else {
      const loser = a.points < b.points ? a : b;
      choppedWeek.set(loser.rosterId, GUILLOTINE_FINAL_WEEK);
      alive = alive.filter(r => r.rosterId !== loser.rosterId);
    }
  }

  const seasonOver = scoredThrough >= GUILLOTINE_FINAL_WEEK;
  const championRosterId =
    seasonOver && alive.length === 1 ? alive[0].rosterId : null;
  if (seasonOver && alive.length > 1 && warnings.length === 0) {
    warnings.push(
      `${alive.length} teams are still alive after week ${GUILLOTINE_FINAL_WEEK}, so there is no champion.`,
    );
  }

  // A chopped team's place is settled the moment it goes: it finished behind
  // everyone who outlasted it, and teams chopped the same week share a place.
  const finish = new Map<number, number>();
  for (const roster of rosters) {
    const week = choppedWeek.get(roster.rosterId);
    if (week === null || week === undefined) continue;
    const outlasted = rosters.filter(other => {
      const otherWeek = choppedWeek.get(other.rosterId);
      return otherWeek === null || otherWeek === undefined || otherWeek > week;
    }).length;
    finish.set(roster.rosterId, outlasted + 1);
  }
  if (championRosterId !== null) finish.set(championRosterId, 1);

  return { choppedWeek, finish, championRosterId, warnings };
}

/**
 * The lineup to store for a week: the matchup's own, or for the week still
 * being played, the roster's current lineup when Sleeper hasn't copied it in.
 *
 * Sleeper leaves a matchup's starters null until the week starts for a team
 * that hasn't touched its lineup, even though that lineup is set and is what
 * will lock at kickoff. A finished week never falls back: the roster's lineup
 * today says nothing about what started back then.
 */
export function weekStarters({
  matchupStarters,
  rosterStarters,
  isLiveWeek,
}: {
  matchupStarters: (string | null)[] | null | undefined;
  rosterStarters: (string | null)[] | null | undefined;
  isLiveWeek: boolean;
}): string[] {
  const starters =
    matchupStarters && matchupStarters.length > 0
      ? matchupStarters
      : isLiveWeek
      ? rosterStarters ?? []
      : [];
  return starters.map(starter => starter ?? '0');
}

/**
 * Who owns each roster. Sleeper's own `owner_id` wins whenever it is there.
 *
 * Without it, the roster's own waiver and free agent moves come next: they
 * name who actually ran the roster. The draft is not good enough on its own,
 * because a draft's picks name whoever held that draft slot, and the manual
 * leagues of 2022 and 2023 handed out rosters in a different order from the
 * slots. There, nearly every roster's picks were made by someone who went on
 * to manage a different roster.
 *
 * Commissioner moves and trades (either side can create one) are left out,
 * and so is anyone who still owns another roster. Each mover is counted for
 * the one roster they made the most moves on, so a commissioner tidying up an
 * abandoned roster is never taken for its owner.
 *
 * The drafter is the fallback for a roster with no moves at all, and only
 * when they are not already the owner of another roster. An autodrafted
 * roster whose manager then left has neither, as three of the 2025 league's
 * did, and stays unowned for the admin to assign by hand.
 */
export function resolveRosterOwners(
  rosters: { roster_id: number; owner_id: string | null }[],
  draftPicks: { roster_id: number; picked_by: string | null }[],
  transactions: { type: string; roster_ids: number[]; creator: string }[] = [],
): Map<number, string | null> {
  const drafter = new Map<number, string>();
  for (const pick of draftPicks) {
    if (pick.picked_by && !drafter.has(pick.roster_id)) {
      drafter.set(pick.roster_id, pick.picked_by);
    }
  }

  const sleeperOwners = new Set(
    rosters.flatMap(roster => (roster.owner_id ? [roster.owner_id] : [])),
  );

  // Creator -> roster ID -> how many moves they made on it.
  const movesByCreator = new Map<string, Map<number, number>>();
  for (const t of transactions) {
    if (t.type === 'commissioner' || t.roster_ids.length !== 1) continue;
    if (!t.creator || sleeperOwners.has(t.creator)) continue;
    const rosterId = t.roster_ids[0];
    const counts = movesByCreator.get(t.creator) ?? new Map<number, number>();
    counts.set(rosterId, (counts.get(rosterId) ?? 0) + 1);
    movesByCreator.set(t.creator, counts);
  }

  // Each creator's home roster, and the moves they made there.
  const moversByRoster = new Map<number, [string, number][]>();
  for (const [creator, counts] of movesByCreator) {
    const [rosterId, moves] = [...counts].sort((a, b) => b[1] - a[1])[0];
    const movers = moversByRoster.get(rosterId) ?? [];
    movers.push([creator, moves]);
    moversByRoster.set(rosterId, movers);
  }
  const mover = (rosterId: number) =>
    moversByRoster.get(rosterId)?.sort((a, b) => b[1] - a[1])[0][0];

  const owners = new Map<number, string | null>(
    rosters.map(roster => [
      roster.roster_id,
      roster.owner_id ?? mover(roster.roster_id) ?? null,
    ]),
  );

  const taken = new Set(owners.values());
  for (const roster of rosters) {
    if (owners.get(roster.roster_id)) continue;
    const owner = drafter.get(roster.roster_id);
    if (owner && !taken.has(owner)) {
      owners.set(roster.roster_id, owner);
      taken.add(owner);
    }
  }

  // Everyone who drafted ran exactly one roster, so when one drafted roster
  // and one drafter are all that is left, they go together. The 2023 league's
  // roster 17 is the case: its drafter ran roster 1, and the one drafter left
  // over made no moves before being chopped.
  const unowned = rosters.filter(roster => !owners.get(roster.roster_id));
  const unused = [...new Set(drafter.values())].filter(d => !taken.has(d));
  if (
    unowned.length === 1 &&
    unused.length === 1 &&
    drafter.has(unowned[0].roster_id)
  ) {
    owners.set(unowned[0].roster_id, unused[0]);
  }

  return owners;
}

/**
 * The weeks worth asking Sleeper for: everything scored, plus the week in
 * progress while a season is live. Nothing before the draft, and never past
 * the final.
 */
export function weeksToSync({
  status,
  lastScoredWeek,
}: {
  status: string | null | undefined;
  lastScoredWeek: number;
}): number {
  if (status === 'pre_draft' || status === 'drafting') return 0;
  if (status === 'complete') return GUILLOTINE_FINAL_WEEK;
  return Math.min(Math.max(lastScoredWeek + 1, 1), GUILLOTINE_FINAL_WEEK);
}
