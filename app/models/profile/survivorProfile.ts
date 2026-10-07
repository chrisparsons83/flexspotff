import type { SurvivorPickResult } from '~/libs/survivor/standings';
import type { BoardCell } from '~/libs/survivor/views';
import { poolWeeks } from '~/libs/survivor/views';

/**
 * The Survivor tab, worked out from each pool the member played. Every entry
 * in those pools is read too: places, how much of the field they outlasted,
 * and whether they went with the crowd all need the rest of the pool.
 */

type Pick = { week: number; team: string; result: SurvivorPickResult };

export type SurvivorPoolInput = {
  poolId: string;
  poolName: string;
  year: number;
  isComplete: boolean;
  startWeek: number;
  entryId: string;
  entries: {
    id: string;
    eliminatedWeek: number | null;
    survivedWeek: number;
    finish: number | null;
    picks: Pick[];
  }[];
};

export type SurvivorPoolResult = {
  poolId: string;
  poolName: string;
  year: number;
  isComplete: boolean;
  entryCount: number;
  /**
   * Their place, ties sharing it. In a pool still running, set once it can no
   * longer change - see `runningPlace`.
   */
  place: number | null;
  /** Entries still alive, the member included. */
  remaining: number;
  /** How many shared first, when they did. */
  winners: number;
  isAlive: boolean;
  eliminatedWeek: number | null;
  /** The team that knocked them out, or null for a missed pick or no exit. */
  outBy: string | null;
  missedPick: boolean;
  weeksWon: number;
  /** Share of the rest of the field they lasted longer than, 0 to 1. */
  outlasted: number | null;
  weeks: number[];
  cells: BoardCell[];
};

export type SurvivorTeamRow = {
  team: string;
  picks: number;
  wins: number;
  losses: number;
};

export type SurvivorCareer = {
  pools: number;
  wins: number;
  bestPlace: { place: number; year: number; poolName: string } | null;
  /** Average share of the field outlasted, over decided pools. */
  averageOutlasted: number | null;
  longestRun: { weeks: number; year: number; poolName: string } | null;
  pickWins: number;
  pickLosses: number;
  missedPicks: number;
  /** Share of their picks that were the week's most popular team. */
  withCrowd: number | null;
  /**
   * The teams that knocked them out most often, when that was more than once.
   * Several when they are tied.
   */
  nemesis: { teams: string[]; times: number } | null;
};

/** The most-picked team among entries alive going into a week. */
function crowdPick(pool: SurvivorPoolInput, week: number): string | null {
  const counts = new Map<string, number>();
  for (const entry of pool.entries) {
    if (entry.eliminatedWeek !== null && entry.eliminatedWeek < week) continue;
    const pick = entry.picks.find(p => p.week === week);
    if (pick) counts.set(pick.team, (counts.get(pick.team) ?? 0) + 1);
  }
  let best: [string, number] | null = null;
  for (const pair of counts) if (!best || pair[1] > best[1]) best = pair;
  // A pick nobody else made is not a crowd.
  return best && best[1] > 1 ? best[0] : null;
}

/**
 * Their place in a pool still running, once it can no longer change: they are
 * out, and everyone still alive has already survived the week they went out
 * in. Until then an entry with a game still to play that week could go out
 * beside them and share the place. Null while it could still move, and when
 * nobody outlasted them - a shared first is for the pool's result to decide.
 */
function runningPlace(
  mine: SurvivorPoolInput['entries'][number],
  others: SurvivorPoolInput['entries'],
): number | null {
  const out = mine.eliminatedWeek;
  if (out === null) return null;
  const alive = others.filter(other => other.eliminatedWeek === null);
  if (alive.some(other => other.survivedWeek < out)) return null;
  const outlastedBy = others.filter(
    other => other.eliminatedWeek === null || other.eliminatedWeek > out,
  ).length;
  return outlastedBy > 0 ? 1 + outlastedBy : null;
}

export function buildSurvivorPool(pool: SurvivorPoolInput): SurvivorPoolResult {
  const mine = pool.entries.find(entry => entry.id === pool.entryId)!;
  const others = pool.entries.filter(entry => entry.id !== pool.entryId);
  const weeks = poolWeeks(pool.startWeek, pool.entries);
  const byWeek = new Map(mine.picks.map(pick => [pick.week, pick]));
  const outPick =
    mine.eliminatedWeek !== null ? byWeek.get(mine.eliminatedWeek) : undefined;

  return {
    poolId: pool.poolId,
    poolName: pool.poolName,
    year: pool.year,
    isComplete: pool.isComplete,
    entryCount: pool.entries.length,
    place: pool.isComplete ? mine.finish : runningPlace(mine, others),
    remaining: pool.entries.filter(entry => entry.eliminatedWeek === null)
      .length,
    winners: pool.entries.filter(entry => entry.finish === 1).length,
    isAlive: mine.eliminatedWeek === null,
    eliminatedWeek: mine.eliminatedWeek,
    outBy: outPick?.team ?? null,
    missedPick: mine.eliminatedWeek !== null && !outPick,
    weeksWon: mine.picks.filter(pick => pick.result === 'WIN').length,
    outlasted:
      pool.isComplete && others.length > 0
        ? others.filter(other => other.survivedWeek < mine.survivedWeek)
            .length / others.length
        : null,
    weeks,
    cells: weeks.map((week): BoardCell => {
      const pick = byWeek.get(week);
      if (pick) return { kind: 'pick', team: pick.team, result: pick.result };
      return week === mine.eliminatedWeek
        ? { kind: 'missed' }
        : { kind: 'none' };
    }),
  };
}

export function buildSurvivorCareer(
  pools: SurvivorPoolInput[],
  results: SurvivorPoolResult[],
): SurvivorCareer {
  const myPicks = pools.flatMap(pool => {
    const mine = pool.entries.find(entry => entry.id === pool.entryId)!;
    return mine.picks.map(pick => ({ pick, pool }));
  });
  const settled = myPicks.filter(({ pick }) => pick.result !== 'PENDING');

  const crowd = settled.filter(
    ({ pick, pool }) => crowdPick(pool, pick.week) === pick.team,
  ).length;

  const placed = results.filter(
    (result): result is SurvivorPoolResult & { place: number } =>
      result.place !== null,
  );
  const best = placed.reduce<(typeof placed)[number] | null>(
    (top, result) => (!top || result.place < top.place ? result : top),
    null,
  );
  const longest = results.reduce<SurvivorPoolResult | null>(
    (top, result) => (!top || result.weeksWon > top.weeksWon ? result : top),
    null,
  );
  const outlasted = results.flatMap(result =>
    result.outlasted === null ? [] : [result.outlasted],
  );

  const busts = new Map<string, number>();
  for (const result of results) {
    if (result.outBy)
      busts.set(result.outBy, (busts.get(result.outBy) ?? 0) + 1);
  }
  const mostTimes = Math.max(0, ...busts.values());

  return {
    pools: results.length,
    wins: placed.filter(result => result.place === 1).length,
    bestPlace: best
      ? { place: best.place, year: best.year, poolName: best.poolName }
      : null,
    averageOutlasted:
      outlasted.length > 0
        ? outlasted.reduce((sum, share) => sum + share, 0) / outlasted.length
        : null,
    longestRun:
      longest && longest.weeksWon > 0
        ? {
            weeks: longest.weeksWon,
            year: longest.year,
            poolName: longest.poolName,
          }
        : null,
    pickWins: settled.filter(({ pick }) => pick.result === 'WIN').length,
    pickLosses: settled.filter(({ pick }) => pick.result === 'LOSS').length,
    missedPicks: results.filter(result => result.missedPick).length,
    withCrowd: settled.length > 0 ? crowd / settled.length : null,
    nemesis:
      mostTimes > 1
        ? {
            teams: [...busts]
              .filter(([, times]) => times === mostTimes)
              .map(([team]) => team)
              .sort(),
            times: mostTimes,
          }
        : null,
  };
}

/** Every team they have picked, most-picked first. */
export function buildSurvivorTeams(
  pools: SurvivorPoolInput[],
): SurvivorTeamRow[] {
  const rows = new Map<string, SurvivorTeamRow>();
  for (const pool of pools) {
    const mine = pool.entries.find(entry => entry.id === pool.entryId)!;
    for (const pick of mine.picks) {
      const row = rows.get(pick.team) ?? {
        team: pick.team,
        picks: 0,
        wins: 0,
        losses: 0,
      };
      row.picks += 1;
      if (pick.result === 'WIN') row.wins += 1;
      if (pick.result === 'LOSS') row.losses += 1;
      rows.set(pick.team, row);
    }
  }
  return [...rows.values()].sort(
    (a, b) =>
      b.picks - a.picks || b.wins - a.wins || a.team.localeCompare(b.team),
  );
}
