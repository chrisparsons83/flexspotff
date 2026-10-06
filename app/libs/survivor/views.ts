import type { SurvivorPickResult } from './standings';
import { normalizeName } from '~/utils/names';

/**
 * What the survivor pages show, worked out from stored entries so it can be
 * tested without a database.
 */

export type ViewEntry = {
  id: string;
  displayName: string | null;
  entryName?: string | null;
  user: { id: string; discordName: string } | null;
  eliminatedWeek: number | null;
  survivedWeek: number;
  finish: number | null;
  picks: { week: number; team: string; result: SurvivorPickResult }[];
};

/**
 * "2023 Flex Spot FF". Sleeper pools already carry their year
 * ("FlexSpot 2025 Part 1 of X"), and saying it twice reads as a typo.
 */
export const poolTitle = (pool: { year: number; name: string }) =>
  pool.name.includes(String(pool.year))
    ? pool.name
    : `${pool.year} ${pool.name}`;

/** The member an entry belongs to, or the name the source has for it. */
export const entryLabel = (entry: {
  displayName: string | null;
  user: { discordName: string } | null;
}) => entry.user?.discordName ?? entry.displayName ?? 'Unknown';

export type BoardCell =
  | { kind: 'pick'; team: string; result: SurvivorPickResult }
  | { kind: 'missed' }
  | { kind: 'none' };

export type BoardRow = {
  id: string;
  name: string;
  /** The Yahoo pick set's own name, when it says something the name does not. */
  entryName: string | null;
  userId: string | null;
  finish: number | null;
  eliminatedWeek: number | null;
  survivedWeek: number;
  cells: BoardCell[];
};

export type WeekSummary = {
  week: number;
  /** Alive going into the week. */
  aliveBefore: number;
  /** Still alive once it was played. */
  aliveAfter: number;
  /** The most-picked team, with how many took it and how it went. */
  topPick: { team: string; count: number; result: SurvivorPickResult } | null;
  /** The team that knocked out the most entries, if any lost. */
  topBust: { team: string; count: number } | null;
  /** Entries out for not picking at all. */
  missed: number;
};

/** The weeks a pool covers: from its first pick to its last pick or out. */
export function poolWeeks(
  startWeek: number,
  entries: Pick<ViewEntry, 'eliminatedWeek' | 'picks'>[],
): number[] {
  const last = Math.max(
    startWeek,
    ...entries.flatMap(entry => [
      ...entry.picks.map(pick => pick.week),
      entry.eliminatedWeek ?? 0,
    ]),
  );
  return Array.from({ length: last - startWeek + 1 }, (_, i) => startWeek + i);
}

/**
 * A Yahoo pick set's name, when someone chose it. Yahoo's own names
 * ("Nicholas's Matchless Pick Set") and ones that only repeat the person's
 * name say nothing the row does not.
 */
function customEntryName(entryName: string | null | undefined, name: string) {
  if (!entryName || /pick set$/i.test(entryName)) return null;
  return normalizeName(entryName).includes(normalizeName(name))
    ? null
    : entryName;
}

const isAliveAfter = (entry: ViewEntry, week: number) =>
  entry.eliminatedWeek === null || entry.eliminatedWeek > week;

/**
 * One row per entry, furthest first: winners, then whoever is still alive,
 * then by how far they got.
 */
export function buildBoard(
  startWeek: number,
  entries: ViewEntry[],
): { weeks: number[]; rows: BoardRow[] } {
  const weeks = poolWeeks(startWeek, entries);

  const rows = entries.map(entry => {
    const byWeek = new Map(entry.picks.map(pick => [pick.week, pick]));
    const name = entryLabel(entry);
    return {
      id: entry.id,
      name,
      entryName: customEntryName(entry.entryName, name),
      userId: entry.user?.id ?? null,
      finish: entry.finish,
      eliminatedWeek: entry.eliminatedWeek,
      survivedWeek: entry.survivedWeek,
      cells: weeks.map((week): BoardCell => {
        const pick = byWeek.get(week);
        if (pick) {
          return { kind: 'pick', team: pick.team, result: pick.result };
        }
        return week === entry.eliminatedWeek
          ? { kind: 'missed' }
          : { kind: 'none' };
      }),
    };
  });

  rows.sort(
    (a, b) =>
      (a.finish ?? Infinity) - (b.finish ?? Infinity) ||
      Number(a.eliminatedWeek !== null) - Number(b.eliminatedWeek !== null) ||
      b.survivedWeek - a.survivedWeek ||
      a.name.localeCompare(b.name),
  );

  return { weeks, rows };
}

/** Most common value in a list, with its count; ties go to the first seen. */
function mostCommon(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best: { team: string; count: number } | null = null;
  for (const [team, count] of counts) {
    if (!best || count > best.count) best = { team, count };
  }
  return best;
}

/** How each week of a pool went. */
export function summarizeWeeks(
  startWeek: number,
  entries: ViewEntry[],
): WeekSummary[] {
  return poolWeeks(startWeek, entries).map(week => {
    const playing = entries.filter(entry => isAliveAfter(entry, week - 1));
    const picks = playing.flatMap(entry =>
      entry.picks.filter(pick => pick.week === week),
    );
    const top = mostCommon(picks.map(pick => pick.team));
    const knockedOut = playing.filter(entry => entry.eliminatedWeek === week);
    const busts = knockedOut.flatMap(entry =>
      entry.picks.filter(pick => pick.week === week),
    );
    return {
      week,
      aliveBefore: playing.length,
      aliveAfter: playing.filter(entry => isAliveAfter(entry, week)).length,
      topPick: top
        ? {
            ...top,
            result:
              picks.find(pick => pick.team === top.team)?.result ?? 'PENDING',
          }
        : null,
      topBust: mostCommon(busts.map(pick => pick.team)),
      missed: knockedOut.filter(
        entry => !entry.picks.some(pick => pick.week === week),
      ).length,
    };
  });
}

export type AllTimeRow = {
  userId: string;
  name: string;
  pools: number;
  wins: number;
  /** The most weeks in a row an entry of theirs picked a winner. */
  longestRun: number;
  /** Weeks survived, summed over every pool. */
  weeksSurvived: number;
};

/**
 * Members ranked by pools won, then by how long they lasted. A run counts
 * weeks won, so an entry that joined a pool late is not penalised for the
 * weeks before it started.
 */
export function buildAllTime(
  pools: {
    isComplete: boolean;
    entries: {
      finish: number | null;
      user: { id: string; discordName: string } | null;
      picks: { result: SurvivorPickResult }[];
    }[];
  }[],
): AllTimeRow[] {
  const rows = new Map<string, AllTimeRow>();
  for (const pool of pools) {
    for (const entry of pool.entries) {
      if (!entry.user) continue;
      const wins = entry.picks.filter(pick => pick.result === 'WIN').length;
      const row = rows.get(entry.user.id) ?? {
        userId: entry.user.id,
        name: entry.user.discordName,
        pools: 0,
        wins: 0,
        longestRun: 0,
        weeksSurvived: 0,
      };
      row.pools += 1;
      row.wins += pool.isComplete && entry.finish === 1 ? 1 : 0;
      row.longestRun = Math.max(row.longestRun, wins);
      row.weeksSurvived += wins;
      rows.set(entry.user.id, row);
    }
  }
  return [...rows.values()].sort(
    (a, b) =>
      b.wins - a.wins ||
      b.longestRun - a.longestRun ||
      b.weeksSurvived - a.weeksSurvived ||
      a.name.localeCompare(b.name),
  );
}
