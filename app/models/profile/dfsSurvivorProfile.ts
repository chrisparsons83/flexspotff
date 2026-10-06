import { DFS_SURVIVOR_SLOTS } from '~/libs/dfs-survivor/slots';
import { assignCompetitionRanks } from '~/utils/rank';

/**
 * The DFS Survivor tab, worked out from rows the server has already loaded -
 * kept apart from `dfsSurvivor.server.ts` so the rules can be tested without a
 * database.
 *
 * Every week a member sets an eleven-slot lineup, and each player can be used
 * once a season. Everyone ends up using most of the same good players, so the
 * game is less about who you pick than when you spend them - and the pool
 * thins as the season goes on. The tab measures that two ways: a pick against
 * every other member who used the same player in a different week, and a
 * member's points early in the season against late.
 */

/** One scored lineup slot. */
export type DfsEntryRow = {
  userId: string;
  year: number;
  week: number;
  /** The lineup slot, e.g. "QB1", "FLEX2", "DEF". */
  slot: string;
  playerId: string;
  points: number;
};

export type DfsPlayer = {
  name: string;
  /** "J. Gibbs", for where the full name will not fit. */
  shortName: string;
  position: string | null;
};

/** Slots with the number dropped, so QB1 and QB2 compare as one position. */
export const SLOT_GROUPS = [
  'QB',
  'RB',
  'WR',
  'TE',
  'FLEX',
  'K',
  'DEF',
] as const;
export type SlotGroup = (typeof SLOT_GROUPS)[number];

/** How many of each slot a full lineup has. */
export const SLOTS_PER_GROUP: Record<SlotGroup, number> = {
  QB: 2,
  RB: 2,
  WR: 2,
  TE: 1,
  FLEX: 2,
  K: 1,
  DEF: 1,
};

export const LINEUP_SIZE = DFS_SURVIVOR_SLOTS.length;

export const slotGroup = (slot: string) =>
  slot.replace(/[12]$/, '') as SlotGroup;

/**
 * Thirds of the season, for watching the pool run dry. Week 17 is the last,
 * so the late stage is five weeks rather than six.
 */
export const STAGES = [
  { key: 'early', label: 'Weeks 1–6', from: 1, to: 6 },
  { key: 'middle', label: 'Weeks 7–12', from: 7, to: 12 },
  { key: 'late', label: 'Weeks 13–17', from: 13, to: 17 },
] as const;
export type StageKey = (typeof STAGES)[number]['key'];

export const stageOf = (week: number): StageKey =>
  STAGES.find(stage => week <= stage.to)?.key ?? 'late';

/** How many of a member's best picks the star timeline follows. */
export const STAR_PICKS = 10;

/** Other members who used the same player in the same season. */
export type DfsOthers = {
  count: number;
  average: number | null;
  /** The best and worst week anyone got from him, this member included. */
  best: number;
  worst: number;
};

export type DfsPick = {
  year: number;
  week: number;
  slot: string;
  group: SlotGroup;
  playerId: string;
  name: string;
  shortName: string;
  position: string | null;
  points: number;
  /** Points above (or below) the field's average pick in this slot that week. */
  vsSlotField: number;
  others: DfsOthers;
  /** Points above the others' average from him; null when nobody else did. */
  vsOthers: number | null;
  /** Got at least as much from him as any other member did. */
  bestTiming: boolean;
};

export type DfsWeek = {
  year: number;
  week: number;
  /** In lineup order, QB1 first. Empty slots are left out. */
  picks: DfsPick[];
  total: number;
  /** Total against the average lineup that week. */
  vsField: number;
  /** Where the total ranked among everyone who set a lineup that week. */
  rank: number;
  fieldSize: number;
  emptySlots: number;
};

export type DfsFinish = { rank: number; fieldSize: number };

/** The spread of every lineup set in one week. */
export type DfsFieldWeek = {
  week: number;
  low: number;
  high: number;
  /** The middle half of the field. */
  q1: number;
  q3: number;
  median: number;
};

export type DfsSeason = {
  year: number;
  inProgress: boolean;
  total: number;
  finish: DfsFinish | null;
  /** Oldest first. */
  weeks: DfsWeek[];
  /** Weeks scored so far that season, whether they played them or not. */
  weeksAvailable: number;
  /** Those weeks' numbers, so a skipped week reads apart from an unplayed one. */
  scoredWeeks: number[];
  /** Every lineup that season, week by week, for charting theirs against. */
  field: DfsFieldWeek[];
  averageWeek: number | null;
  /** Average weekly total against the average lineup those weeks. */
  vsField: number | null;
  bestWeek: DfsWeek | null;
  worstWeek: DfsWeek | null;
  weeklyWins: number;
  playersUsed: number;
};

export type DfsTiming = {
  /** Picks of a player somebody else used too. */
  compared: number;
  /** Average points over the others who used the same player. */
  edge: number | null;
  /** Compared picks that beat, or fell short of, the others' average. */
  ahead: number;
  behind: number;
  bestTimingPicks: number;
  /** Weeks 13–17, against the average lineup in those weeks. */
  lateVsField: number | null;
  lateWeeks: number;
};

export type DfsCareer = {
  weeks: number;
  averageWeek: number | null;
  vsField: number | null;
  /** Weeks their lineup beat the average lineup. */
  aboveAverage: number;
  bestWeek: DfsWeek | null;
  worstWeek: DfsWeek | null;
  weeklyWins: number;
  bestPick: DfsPick | null;
  averagePick: number | null;
  /** Picks of 20 points or more. */
  bigPicks: number;
  picks: number;
  timing: DfsTiming;
  completedSeasons: number;
  titles: number;
  topThrees: number;
  topFives: number;
  bestFinish: (DfsFinish & { year: number }) | null;
  averageFinish: number | null;
  current: (DfsFinish & { year: number }) | null;
};

export const BIG_PICK = 20;

export type StageSplit = {
  stage: StageKey;
  mine: number | null;
  field: number | null;
};

export type DfsPoolSeason = {
  year: number;
  /** Average weekly total in each stage, against the average lineup. */
  lineup: StageSplit[];
  /** Average pick in each stage, by position, against the field's. */
  groups: { group: SlotGroup; stages: StageSplit[] }[];
  /** Their best picks of the season, highest first. */
  stars: DfsPick[];
  starAverageWeek: number | null;
  /** The same, averaged over every other member's own best picks. */
  fieldStarAverageWeek: number | null;
};

export type DfsPositionRow = {
  group: SlotGroup;
  picks: number;
  average: number | null;
  /** The field's average pick in this slot, over the weeks they played. */
  fieldAverage: number | null;
  emptySlots: number;
  best: DfsPick | null;
  worst: DfsPick | null;
  /** What filled a FLEX slot, and how each did there; empty for the rest. */
  flex: FlexFill[];
};

export const FLEX_POSITIONS = ['RB', 'WR', 'TE'] as const;

export type FlexFill = {
  position: (typeof FLEX_POSITIONS)[number];
  picks: number;
  average: number | null;
};

const average = (values: number[]) =>
  values.length > 0
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;

/**
 * Sums are kept to the cent, the precision entries are stored at, so two
 * lineups with the same points tie rather than differ by float dust.
 */
const cents = (value: number) => Math.round(value * 100) / 100;

const sumPoints = (rows: { points: number }[]) =>
  cents(rows.reduce((sum, row) => sum + row.points, 0));

function groupBy<T, K>(items: T[], keyOf: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const existing = groups.get(key);
    if (existing) existing.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}

/**
 * Highest and lowest by `scoreOf`. The first one seen wins a tie, so callers
 * feed marks oldest first and the earlier week keeps the record.
 */
function extremes<T>(marks: T[], scoreOf: (mark: T) => number) {
  let best: T | null = null;
  let worst: T | null = null;
  for (const mark of marks) {
    if (best === null || scoreOf(mark) > scoreOf(best)) best = mark;
    if (worst === null || scoreOf(mark) < scoreOf(worst)) worst = mark;
  }
  return { best, worst };
}

const weekKey = (year: number, week: number) => `${year}-${week}`;

const UNKNOWN: DfsPlayer = {
  name: 'Unknown player',
  shortName: 'Unknown',
  position: null,
};

const slotOrder = (slot: string) => {
  const index = (DFS_SURVIVOR_SLOTS as readonly string[]).indexOf(slot);
  return index === -1 ? DFS_SURVIVOR_SLOTS.length : index;
};

/** Each member's lineup total per week, keyed by `weekKey`. */
function lineupTotals(rows: DfsEntryRow[]) {
  const totals = new Map<string, Map<string, number>>();
  for (const [key, weekRows] of groupBy(rows, row =>
    weekKey(row.year, row.week),
  )) {
    totals.set(
      key,
      new Map(
        Array.from(groupBy(weekRows, row => row.userId)).map(
          ([userId, lineup]) => [userId, sumPoints(lineup)],
        ),
      ),
    );
  }
  return totals;
}

/**
 * Every entrant's total per season, summed to the cent. Shared with the DFS
 * Survivor Champion badge, so the tab's finishes and the badge agree on who
 * won - including a tie that raw float sums would split.
 */
export function buildDfsSeasonTotals(
  rows: Pick<DfsEntryRow, 'userId' | 'year' | 'points'>[],
): Map<number, Map<string, number>> {
  const totals = new Map<number, Map<string, number>>();
  for (const [year, yearRows] of groupBy(rows, row => row.year)) {
    totals.set(
      year,
      new Map(
        Array.from(groupBy(yearRows, row => row.userId)).map(
          ([entrant, entries]) => [entrant, sumPoints(entries)],
        ),
      ),
    );
  }
  return totals;
}

/**
 * Where the member finished each season, among everyone who set a lineup in
 * it. A skipped week scores nothing, so it simply adds nothing to the total.
 */
export function buildDfsFinishes(
  rows: DfsEntryRow[],
  userId: string,
): Map<number, DfsFinish> {
  const finishes = new Map<number, DfsFinish>();

  for (const [year, totals] of buildDfsSeasonTotals(rows)) {
    const ranked = assignCompetitionRanks(
      Array.from(totals)
        .map(([entrant, points]) => ({ userId: entrant, points }))
        .sort((a, b) => b.points - a.points),
      entry => entry.points,
    );
    const mine = ranked.find(entry => entry.userId === userId);
    if (mine) finishes.set(year, { rank: mine.rank, fieldSize: ranked.length });
  }

  return finishes;
}

/**
 * The member's lineups, oldest first, each pick measured against the field
 * twice: against everyone's pick in the same slot that week, and against the
 * other members who spent the same player in another week of the season.
 * `rows` must hold the whole field for every season the member played.
 */
export function buildDfsWeeks(
  rows: DfsEntryRow[],
  userId: string,
  players: Map<string, DfsPlayer>,
): DfsWeek[] {
  const totals = lineupTotals(rows);

  // The field's average pick per slot per week.
  const slotAverages = new Map<string, number>();
  for (const [key, slotRows] of groupBy(
    rows,
    row => `${weekKey(row.year, row.week)}-${slotGroup(row.slot)}`,
  )) {
    slotAverages.set(key, average(slotRows.map(row => row.points))!);
  }

  // Everyone's uses of each player, per season.
  const uses = groupBy(rows, row => `${row.year}-${row.playerId}`);

  const mine = rows.filter(row => row.userId === userId);
  const weeks: DfsWeek[] = [];

  for (const [key, lineup] of groupBy(mine, row =>
    weekKey(row.year, row.week),
  )) {
    const { year, week } = lineup[0];
    const field = totals.get(key)!;
    const ranked = assignCompetitionRanks(
      Array.from(field)
        .map(([entrant, points]) => ({ userId: entrant, points }))
        .sort((a, b) => b.points - a.points),
      entry => entry.points,
    );
    const total = field.get(userId)!;

    const picks = lineup
      .map((row): DfsPick => {
        const player = players.get(row.playerId) ?? UNKNOWN;
        const group = slotGroup(row.slot);
        const all = uses.get(`${row.year}-${row.playerId}`) ?? [row];
        const others = all.filter(use => use.userId !== userId);
        const othersAverage = average(others.map(use => use.points));
        const everyone = all.map(use => use.points);

        return {
          year,
          week,
          slot: row.slot,
          group,
          playerId: row.playerId,
          name: player.name,
          shortName: player.shortName,
          position: player.position,
          points: row.points,
          vsSlotField:
            row.points - (slotAverages.get(`${key}-${group}`) ?? row.points),
          others: {
            count: others.length,
            average: othersAverage,
            best: Math.max(...everyone),
            worst: Math.min(...everyone),
          },
          vsOthers: othersAverage === null ? null : row.points - othersAverage,
          bestTiming:
            others.length > 0 &&
            others.every(other => row.points >= other.points),
        };
      })
      .sort((a, b) => slotOrder(a.slot) - slotOrder(b.slot));

    weeks.push({
      year,
      week,
      picks,
      total,
      vsField: total - average(Array.from(field.values()))!,
      rank: ranked.find(entry => entry.userId === userId)?.rank ?? 1,
      fieldSize: field.size,
      emptySlots: Math.max(0, LINEUP_SIZE - picks.length),
    });
  }

  return weeks.sort((a, b) => a.year - b.year || a.week - b.week);
}

/** Linear interpolation between the closest ranks, as spreadsheets do it. */
function quantile(sorted: number[], q: number) {
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

/**
 * The spread of lineup totals each scored week, per season, oldest week
 * first. Only members who set a lineup that week are in it: a skipped week is
 * not a zero-point lineup, and counting it as one would drag the low edge to
 * the floor as members drift away.
 */
export function buildDfsFieldWeeks(
  rows: DfsEntryRow[],
): Map<number, DfsFieldWeek[]> {
  const fields = new Map<number, DfsFieldWeek[]>();

  for (const [key, totals] of lineupTotals(rows)) {
    const [year, week] = key.split('-').map(Number);
    const sorted = Array.from(totals.values()).sort((a, b) => a - b);
    if (!fields.has(year)) fields.set(year, []);
    fields.get(year)!.push({
      week,
      low: sorted[0],
      high: sorted[sorted.length - 1],
      q1: quantile(sorted, 0.25),
      q3: quantile(sorted, 0.75),
      median: quantile(sorted, 0.5),
    });
  }
  for (const weeks of fields.values()) weeks.sort((a, b) => a.week - b.week);

  return fields;
}

/** One entry per season the member played, newest first. */
export function buildDfsSeasons({
  weeks,
  rows,
  finishes,
  inProgressYear,
}: {
  weeks: DfsWeek[];
  /** The whole field, for how many weeks each season has scored. */
  rows: DfsEntryRow[];
  finishes: Map<number, DfsFinish>;
  inProgressYear: number | null;
}): DfsSeason[] {
  const scoredWeeks = new Map<number, Set<number>>();
  for (const row of rows) {
    if (!scoredWeeks.has(row.year)) scoredWeeks.set(row.year, new Set());
    scoredWeeks.get(row.year)!.add(row.week);
  }
  const fields = buildDfsFieldWeeks(rows);

  return Array.from(groupBy(weeks, week => week.year))
    .map(([year, yearWeeks]) => {
      const { best, worst } = extremes(yearWeeks, week => week.total);
      return {
        year,
        inProgress: year === inProgressYear,
        total: cents(yearWeeks.reduce((sum, week) => sum + week.total, 0)),
        finish: finishes.get(year) ?? null,
        weeks: yearWeeks,
        weeksAvailable: scoredWeeks.get(year)?.size ?? yearWeeks.length,
        scoredWeeks: Array.from(scoredWeeks.get(year) ?? []).sort(
          (a, b) => a - b,
        ),
        field: fields.get(year) ?? [],
        averageWeek: average(yearWeeks.map(week => week.total)),
        vsField: average(yearWeeks.map(week => week.vsField)),
        bestWeek: best,
        worstWeek: worst,
        weeklyWins: yearWeeks.filter(week => week.rank === 1).length,
        playersUsed: new Set(
          yearWeeks.flatMap(week => week.picks.map(pick => pick.playerId)),
        ).size,
      };
    })
    .sort((a, b) => b.year - a.year);
}

/**
 * Career numbers from the season list. Every scored week counts, the running
 * season's included; finishes and titles wait for a season to end, the same
 * rule the DFS Survivor Champion badge follows.
 */
export function buildDfsCareer(seasons: DfsSeason[]): DfsCareer {
  const oldestFirst = [...seasons].sort((a, b) => a.year - b.year);
  const weeks = oldestFirst.flatMap(season => season.weeks);
  const picks = weeks.flatMap(week => week.picks);
  const { best, worst } = extremes(weeks, week => week.total);
  const { best: bestPick } = extremes(picks, pick => pick.points);

  const compared = picks.filter(pick => pick.vsOthers !== null);
  const late = weeks.filter(week => stageOf(week.week) === 'late');

  const finishes = oldestFirst.flatMap(season =>
    !season.inProgress && season.finish
      ? [{ ...season.finish, year: season.year }]
      : [],
  );
  let bestFinish: DfsCareer['bestFinish'] = null;
  for (const finish of finishes) {
    // Latest wins a tie, so a repeat champion is shown their newest title.
    if (!bestFinish || finish.rank <= bestFinish.rank) bestFinish = finish;
  }
  const running = seasons.find(season => season.inProgress);

  return {
    weeks: weeks.length,
    averageWeek: average(weeks.map(week => week.total)),
    vsField: average(weeks.map(week => week.vsField)),
    aboveAverage: weeks.filter(week => week.vsField > 0).length,
    bestWeek: best,
    worstWeek: worst,
    weeklyWins: weeks.filter(week => week.rank === 1).length,
    bestPick,
    averagePick: average(picks.map(pick => pick.points)),
    bigPicks: picks.filter(pick => pick.points >= BIG_PICK).length,
    picks: picks.length,
    timing: {
      compared: compared.length,
      edge: average(compared.map(pick => pick.vsOthers!)),
      ahead: compared.filter(pick => pick.vsOthers! > 0).length,
      behind: compared.filter(pick => pick.vsOthers! < 0).length,
      bestTimingPicks: compared.filter(pick => pick.bestTiming).length,
      lateVsField: average(late.map(week => week.vsField)),
      lateWeeks: late.length,
    },
    completedSeasons: oldestFirst.filter(season => !season.inProgress).length,
    titles: finishes.filter(finish => finish.rank === 1).length,
    topThrees: finishes.filter(finish => finish.rank <= 3).length,
    topFives: finishes.filter(finish => finish.rank <= 5).length,
    bestFinish,
    averageFinish: average(finishes.map(finish => finish.rank)),
    current:
      running?.finish != null
        ? { ...running.finish, year: running.year }
        : null,
  };
}

/** Average week of an entrant's best picks, by points. */
const starWeek = (entries: { week: number; points: number }[]) =>
  average(
    [...entries]
      .sort((a, b) => b.points - a.points || a.week - b.week)
      .slice(0, STAR_PICKS)
      .map(entry => entry.week),
  );

/**
 * How each season's pool held up: their points in each third of the season
 * against the field's, and when they spent their best picks. The field here is
 * every pick of the season, not just the weeks they played, since the point is
 * how the pool itself thinned.
 */
export function buildDfsPool(
  seasons: DfsSeason[],
  rows: DfsEntryRow[],
  userId: string,
): DfsPoolSeason[] {
  const byYear = groupBy(rows, row => row.year);

  return seasons.map(season => {
    const yearRows = byYear.get(season.year) ?? [];
    const myPicks = season.weeks.flatMap(week => week.picks);

    // Every lineup's total, for the field's average week in each stage.
    const lineups = Array.from(
      groupBy(yearRows, row => `${row.week}-${row.userId}`).values(),
    ).map(lineup => ({ week: lineup[0].week, total: sumPoints(lineup) }));

    // The field's picks by slot and stage, grouped once rather than refiltered
    // for every cell of the table.
    const fieldPicks = groupBy(
      yearRows,
      row => `${slotGroup(row.slot)}-${stageOf(row.week)}`,
    );

    const lineup = STAGES.map(stage => ({
      stage: stage.key,
      mine: average(
        season.weeks
          .filter(week => stageOf(week.week) === stage.key)
          .map(week => week.total),
      ),
      field: average(
        lineups
          .filter(row => stageOf(row.week) === stage.key)
          .map(row => row.total),
      ),
    }));

    const groups = SLOT_GROUPS.map(group => ({
      group,
      stages: STAGES.map(stage => ({
        stage: stage.key,
        mine: average(
          myPicks
            .filter(
              pick => pick.group === group && stageOf(pick.week) === stage.key,
            )
            .map(pick => pick.points),
        ),
        field: average(
          (fieldPicks.get(`${group}-${stage.key}`) ?? []).map(
            row => row.points,
          ),
        ),
      })),
    }));

    const stars = [...myPicks]
      .sort((a, b) => b.points - a.points || a.week - b.week)
      .slice(0, STAR_PICKS);

    const fieldStarWeeks = Array.from(groupBy(yearRows, row => row.userId))
      .filter(([entrant]) => entrant !== userId)
      .map(([, entries]) => starWeek(entries))
      .filter((week): week is number => week !== null);

    return {
      year: season.year,
      lineup,
      groups,
      stars,
      starAverageWeek: average(stars.map(pick => pick.week)),
      fieldStarAverageWeek: average(fieldStarWeeks),
    };
  });
}

/**
 * Each slot over their career, against the field's pick in the same slot in
 * the weeks they played. A FLEX also says what filled it.
 */
export function buildDfsPositions(weeks: DfsWeek[]): DfsPositionRow[] {
  const picks = weeks.flatMap(week => week.picks);

  return SLOT_GROUPS.map(group => {
    const groupPicks = picks.filter(pick => pick.group === group);
    const { best, worst } = extremes(groupPicks, pick => pick.points);
    const flex: FlexFill[] =
      group === 'FLEX'
        ? FLEX_POSITIONS.map(position => {
            const filled = groupPicks.filter(
              pick => pick.position === position,
            );
            return {
              position,
              picks: filled.length,
              average: average(filled.map(pick => pick.points)),
            };
          })
        : [];

    return {
      group,
      picks: groupPicks.length,
      average: average(groupPicks.map(pick => pick.points)),
      // A pick's slot average is its points less how far it beat the field.
      fieldAverage: average(
        groupPicks.map(pick => pick.points - pick.vsSlotField),
      ),
      emptySlots: SLOTS_PER_GROUP[group] * weeks.length - groupPicks.length,
      best,
      worst,
      flex,
    };
  });
}
