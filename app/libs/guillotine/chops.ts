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

    let lastWeekWithPlayers: number | null = null;
    for (let week = 1; week <= scoredThrough; week++) {
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
 * Who owns each roster. Sleeper's own `owner_id` wins; the draft fills the
 * gap for a roster whose manager has since been removed from the league,
 * which is how the 2021 league ended up.
 */
export function resolveRosterOwners(
  rosters: { roster_id: number; owner_id: string | null }[],
  draftPicks: { roster_id: number; picked_by: string | null }[],
): Map<number, string | null> {
  const drafter = new Map<number, string>();
  for (const pick of draftPicks) {
    if (pick.picked_by && !drafter.has(pick.roster_id)) {
      drafter.set(pick.roster_id, pick.picked_by);
    }
  }

  return new Map(
    rosters.map(roster => [
      roster.roster_id,
      roster.owner_id ?? drafter.get(roster.roster_id) ?? null,
    ]),
  );
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
