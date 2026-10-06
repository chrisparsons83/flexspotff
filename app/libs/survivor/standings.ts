/**
 * How a survivor pool is read and ranked, kept apart from the database so it
 * can be tested on its own. See docs/survivor/plan.md.
 */

export type SurvivorPickResult = 'WIN' | 'LOSS' | 'PENDING';

export type SurvivorPickInput = {
  week: number;
  /** NFL team abbreviation, as NFLTeam.sleeperId has it. */
  team: string;
  result: SurvivorPickResult;
};

export type SurvivorEntryOutcome = {
  /** The week the entry lost or missed its pick, or null if it never did. */
  eliminatedWeek: number | null;
  picks: SurvivorPickInput[];
};

/** "v1:regular:5" -> 5. Anything that is not a regular-season week is null. */
export function legWeek(legId: string): number | null {
  const match = /^v\d+:regular:(\d+)$/.exec(legId);
  return match ? Number(match[1]) : null;
}

/**
 * What a Sleeper survivor roster's metadata holds. Every field is optional:
 * Sleeper changed the shape between 2024 and 2025, and a roster that has not
 * picked yet carries almost nothing.
 */
export type SleeperSurvivorMetadata = {
  is_eliminated?: string | null;
  /** 2025 on: the week the roster went out, as a one-item list. */
  lost_leg_ids?: string[] | null;
  /** 2024: the week the roster went out. */
  eliminated_leg_id?: string | null;
  /** Every week's pick, by leg; an empty list for a week with no pick. */
  previous_picks?: Record<string, string[] | null> | null;
  /** 1 for a week the pick won, 0 otherwise. */
  points_by_leg?: Record<string, number | null> | null;
};

/**
 * One Sleeper roster's picks and the week it went out.
 *
 * Sleeper records the week of a loss and the week of a missed pick the same
 * way, so a missed pick is simply an elimination week with no pick in it.
 * A pick scores 1 once it has won; until its game is over it scores 0, which
 * is what tells a pending pick from a loss. Once the pool is over nothing is
 * pending, so a 0 is a loss even without an elimination: Sleeper stops
 * knocking out the last one standing, and the 2025 winner lost in week 18
 * and stayed alive.
 */
export function readSleeperEntry(
  metadata: SleeperSurvivorMetadata | null | undefined,
  { poolIsOver = false }: { poolIsOver?: boolean } = {},
): SurvivorEntryOutcome {
  const lostWeeks = (metadata?.lost_leg_ids ?? [])
    .map(legWeek)
    .filter((week): week is number => week !== null);
  const eliminatedLeg = metadata?.eliminated_leg_id
    ? legWeek(metadata.eliminated_leg_id)
    : null;

  // Points are read by the pick's own leg ID, so a leg version other than v1
  // still finds its score.
  const read: (SurvivorPickInput & { points: number })[] = [];
  for (const [leg, teams] of Object.entries(metadata?.previous_picks ?? {})) {
    const week = legWeek(leg);
    const team = teams?.[0];
    if (week === null || !team) continue;
    const points = metadata?.points_by_leg?.[leg] ?? 0;
    read.push({ week, team, result: 'PENDING', points });
  }
  read.sort((a, b) => a.week - b.week);

  let eliminatedWeek =
    lostWeeks.length > 0 ? Math.min(...lostWeeks) : eliminatedLeg;
  // Out, but Sleeper did not say when. An entry that is out has nothing
  // pending, so a pick that did not win is the loss; with none, it can only
  // have been the week after the last pick, which is the pick that was missed.
  if (eliminatedWeek === null && metadata?.is_eliminated === 'true') {
    eliminatedWeek =
      read.find(pick => pick.points <= 0)?.week ?? (read.at(-1)?.week ?? 0) + 1;
  }

  const picks: SurvivorPickInput[] = read.map(({ week, team, points }) => ({
    week,
    team,
    result:
      points > 0
        ? 'WIN'
        : week === eliminatedWeek || poolIsOver
        ? 'LOSS'
        : 'PENDING',
  }));

  return { eliminatedWeek, picks };
}

/**
 * How far an entry got: the last week it picked a winner, or 0 if it never
 * did. This rather than the elimination week, since an entry can join late or
 * go out without ever having picked.
 */
export function survivedWeek(picks: SurvivorPickInput[]): number {
  return picks.reduce(
    (last, pick) => (pick.result === 'WIN' ? Math.max(last, pick.week) : last),
    0,
  );
}

/**
 * Whether a pool's winner is settled: the source says the pool is over,
 * everyone is out, or one entry is left and has won the week the last of the
 * others went out in. That last check matters while that week is still being
 * played: with the survivor's own pick pending, everyone knocked out that
 * week would otherwise tie with them for first until the game ends.
 *
 * Sleeper never marks a pool that everyone is out of as complete (a new pool
 * is started instead), so this cannot simply wait for the source.
 */
export function isPoolDecided({
  sourceComplete,
  entries,
}: {
  sourceComplete: boolean;
  entries: { eliminatedWeek: number | null; picks: SurvivorPickInput[] }[];
}): boolean {
  if (sourceComplete) return true;
  const alive = entries.filter(entry => entry.eliminatedWeek === null);
  if (alive.length > 1 || alive.length === entries.length) return false;
  if (alive.length === 0) return true;

  const lastOut = Math.max(...entries.map(entry => entry.eliminatedWeek ?? 0));
  return survivedWeek(alive[0].picks) >= lastOut;
}

/**
 * Places by how far each entry got: whoever lasted longest wins, and entries
 * that went out in the same week share a place, so a pool can have co-winners.
 */
export function rankEntries<K>(
  entries: { key: K; survivedWeek: number }[],
): Map<K, number> {
  return new Map(
    entries.map(entry => [
      entry.key,
      1 +
        entries.filter(other => other.survivedWeek > entry.survivedWeek).length,
    ]),
  );
}

/** The first week anyone picked in, or 1 for a pool with no picks yet. */
export function poolStartWeek(entries: { picks: { week: number }[] }[]) {
  const weeks = entries.flatMap(entry => entry.picks.map(pick => pick.week));
  return weeks.length > 0 ? Math.min(...weeks) : 1;
}
