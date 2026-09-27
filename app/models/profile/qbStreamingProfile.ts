import {
  qbStreamingSeasonTotal,
  qbStreamingUsesTopWeeks,
  QB_STREAMING_COUNTING_WEEKS,
  selectCountingWeeks,
} from './sideGameScoring';
import { assignCompetitionRanks } from '~/utils/rank';

/**
 * The QB Streaming tab, worked out from rows the server has already loaded -
 * kept apart from `qbStreaming.server.ts` so the rules can be tested without a
 * database.
 *
 * Every week a member makes two picks: a *standard* QB and a *deep* QB from a
 * list of longer shots. The tab judges each against the rest of the field that
 * week, since a 14-point deep pick in a week where the deep QBs averaged 8 is a
 * better pick than it looks.
 *
 * The standard list includes the deep QBs, so a member can take the same QB
 * with both picks - "doubling up". About a third of all entries do.
 */

/** One member's picks for one scored week. */
export type QbSelectionRow = {
  userId: string;
  year: number;
  week: number;
  standard: { playerId: string; points: number };
  deep: { playerId: string; points: number };
};

export type QbPlayer = {
  firstName: string;
  lastName: string;
  /** The placeholder the history import files an empty slot under. */
  noPick?: boolean;
};

/**
 * One QB on a week's list. For seasons imported from the old sheets the list
 * only holds QBs somebody picked, since that is all the sheets recorded.
 */
export type QbOptionRow = {
  year: number;
  week: number;
  isDeep: boolean;
  points: number;
};

/** The top score on each week's lists, keyed by `weekKey`. */
export type BestAvailable = Map<string, { standard: number; deep: number }>;

export type QbPick = {
  playerId: string;
  name: string;
  /** "G. Minshew", for where the full name will not fit. */
  shortName: string;
  points: number;
  /** Points above (or below) the field's average pick of the same kind. */
  vsField: number;
  /**
   * The top scorer on the list it was picked from. The standard list holds
   * every QB, deep ones included, so that is measured against all of them.
   */
  topPick: boolean;
  noPick: boolean;
};

export type QbWeek = {
  year: number;
  week: number;
  standard: QbPick;
  deep: QbPick;
  total: number;
  vsField: number;
  /** Where the total ranked among everyone who played that week. */
  rank: number;
  fieldSize: number;
  /** False for a week dropped by the best-twelve rule. */
  counts: boolean;
  /** The same QB with both picks. */
  doubled: boolean;
};

export type QbFinish = { rank: number; fieldSize: number };

export type QbSeason = {
  year: number;
  inProgress: boolean;
  usesTopWeeks: boolean;
  /** Under the rule that season was scored by, so it matches the standings. */
  total: number;
  finish: QbFinish | null;
  /** Oldest first. */
  weeks: QbWeek[];
  averageWeek: number | null;
  averageStandard: number | null;
  averageDeep: number | null;
  standardVsField: number | null;
  deepVsField: number | null;
  bestWeek: QbWeek | null;
  worstWeek: QbWeek | null;
  weeklyWins: number;
};

export type QbPickMark = {
  points: number;
  year: number;
  week: number;
  name: string;
};

export type QbSideCareer = {
  average: number | null;
  vsField: number | null;
  /** Weeks this pick outscored the field's average pick. */
  beatFieldWeeks: number;
  /** Weeks this pick was the top scorer on its list. */
  topPickWeeks: number;
  best: QbPickMark | null;
  worst: QbPickMark | null;
};

export type QbCareer = {
  weeks: number;
  averageWeek: number | null;
  vsField: number | null;
  bestWeek: QbWeek | null;
  worstWeek: QbWeek | null;
  weeklyWins: number;
  doubledWeeks: number;
  standard: QbSideCareer;
  deep: QbSideCareer;
  /** Finishes only count once a season is over. */
  completedSeasons: number;
  titles: number;
  topThrees: number;
  topFives: number;
  bestFinish: (QbFinish & { year: number }) | null;
  averageFinish: number | null;
  current: (QbFinish & { year: number }) | null;
};

export type QbExposureRow = {
  playerId: string;
  name: string;
  /** Both picks count, so a doubled-up week is two. */
  picks: number;
  standardOnly: number;
  deepOnly: number;
  /** Weeks he took both picks - two picks each. */
  doubled: number;
  /** Picks in each season, keyed by year. */
  byYear: Record<number, number>;
  averagePoints: number;
  bestPoints: number;
  worstPoints: number;
};

const average = (values: number[]) =>
  values.length > 0
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;

const sum = (values: number[]) =>
  values.reduce((total, value) => total + value, 0);

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

const UNKNOWN = 'Unknown QB';
const NO_PICK = 'No pick';

export function playerName(player: QbPlayer | undefined) {
  if (player?.noPick) return NO_PICK;
  return player ? `${player.firstName} ${player.lastName}` : UNKNOWN;
}

export function shortPlayerName(player: QbPlayer | undefined) {
  if (player?.noPick) return NO_PICK;
  return player ? `${player.firstName.charAt(0)}. ${player.lastName}` : UNKNOWN;
}

const weekKey = (year: number, week: number) => `${year}-${week}`;

export function buildBestAvailable(options: QbOptionRow[]): BestAvailable {
  const best: BestAvailable = new Map();
  for (const option of options) {
    const key = weekKey(option.year, option.week);
    const entry = best.get(key) ?? { standard: -Infinity, deep: -Infinity };
    entry.standard = Math.max(entry.standard, option.points);
    if (option.isDeep) entry.deep = Math.max(entry.deep, option.points);
    best.set(key, entry);
  }
  return best;
}

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
 * Where the member finished each season, among everyone who played it. Totals
 * go through `qbStreamingSeasonTotal`, so a best-twelve season ranks the way
 * its standings page does.
 */
export function buildQbFinishes(
  rows: QbSelectionRow[],
  userId: string,
): Map<number, QbFinish> {
  const finishes = new Map<number, QbFinish>();

  for (const [year, yearRows] of groupBy(rows, row => row.year)) {
    const ranked = assignCompetitionRanks(
      Array.from(groupBy(yearRows, row => row.userId).entries())
        .map(([entrant, weeks]) => ({
          userId: entrant,
          points: qbStreamingSeasonTotal(
            weeks.map(week => week.standard.points + week.deep.points),
            year,
          ),
        }))
        .sort((a, b) => b.points - a.points),
      entry => entry.points,
    );
    const mine = ranked.find(entry => entry.userId === userId);
    if (mine) finishes.set(year, { rank: mine.rank, fieldSize: ranked.length });
  }

  return finishes;
}

/**
 * The member's weeks, each measured against that week's field, oldest first.
 * `rows` must hold the whole field for every week the member played.
 */
export function buildQbWeeks(
  rows: QbSelectionRow[],
  userId: string,
  players: Map<string, QbPlayer>,
  bestAvailable: BestAvailable = new Map(),
): QbWeek[] {
  const byWeek = groupBy(rows, row => weekKey(row.year, row.week));
  const weeks: QbWeek[] = [];

  for (const row of rows) {
    if (row.userId !== userId) continue;

    const field = byWeek.get(weekKey(row.year, row.week)) ?? [row];
    const fieldStandard = average(field.map(entry => entry.standard.points))!;
    const fieldDeep = average(field.map(entry => entry.deep.points))!;

    const total = row.standard.points + row.deep.points;
    const ranked = assignCompetitionRanks(
      field
        .map(entry => ({
          userId: entry.userId,
          total: entry.standard.points + entry.deep.points,
        }))
        .sort((a, b) => b.total - a.total),
      entry => entry.total,
    );

    const best = bestAvailable.get(weekKey(row.year, row.week));
    const pick = (
      side: QbSelectionRow['standard'],
      fieldAverage: number,
      listBest: number | undefined,
    ): QbPick => {
      const player = players.get(side.playerId);
      const noPick = player?.noPick ?? false;
      return {
        playerId: side.playerId,
        name: playerName(player),
        shortName: shortPlayerName(player),
        points: side.points,
        vsField: side.points - fieldAverage,
        topPick: !noPick && listBest !== undefined && side.points >= listBest,
        noPick,
      };
    };
    const standard = pick(row.standard, fieldStandard, best?.standard);
    const deep = pick(row.deep, fieldDeep, best?.deep);

    weeks.push({
      year: row.year,
      week: row.week,
      standard,
      deep,
      total,
      vsField: total - fieldStandard - fieldDeep,
      rank: ranked.find(entry => entry.userId === userId)?.rank ?? 1,
      fieldSize: field.length,
      counts: true,
      doubled: !standard.noPick && row.standard.playerId === row.deep.playerId,
    });
  }

  return weeks.sort((a, b) => a.year - b.year || a.week - b.week);
}

/** One entry per season the member played, newest first. */
export function buildQbSeasons({
  weeks,
  finishes,
  inProgressYear,
}: {
  weeks: QbWeek[];
  finishes: Map<number, QbFinish>;
  inProgressYear: number | null;
}): QbSeason[] {
  return Array.from(groupBy(weeks, week => week.year).entries())
    .map(([year, yearWeeks]) => {
      const usesTopWeeks = qbStreamingUsesTopWeeks(year);
      const counting = new Set(
        usesTopWeeks
          ? selectCountingWeeks(
              yearWeeks,
              week => week.total,
              QB_STREAMING_COUNTING_WEEKS,
            )
          : yearWeeks,
      );
      const marked = yearWeeks.map(week => ({
        ...week,
        counts: counting.has(week),
      }));
      const { best, worst } = extremes(marked, week => week.total);

      return {
        year,
        inProgress: year === inProgressYear,
        usesTopWeeks,
        total: qbStreamingSeasonTotal(
          marked.map(week => week.total),
          year,
        ),
        finish: finishes.get(year) ?? null,
        weeks: marked,
        averageWeek: average(marked.map(week => week.total)),
        averageStandard: average(marked.map(week => week.standard.points)),
        averageDeep: average(marked.map(week => week.deep.points)),
        standardVsField: average(marked.map(week => week.standard.vsField)),
        deepVsField: average(marked.map(week => week.deep.vsField)),
        bestWeek: best,
        worstWeek: worst,
        weeklyWins: marked.filter(week => week.rank === 1).length,
      };
    })
    .sort((a, b) => b.year - a.year);
}

function sideCareer(weeks: QbWeek[], side: 'standard' | 'deep'): QbSideCareer {
  const marks = weeks.map(week => ({
    points: week[side].points,
    year: week.year,
    week: week.week,
    name: week[side].shortName,
  }));
  const { best, worst } = extremes(marks, mark => mark.points);

  return {
    average: average(marks.map(mark => mark.points)),
    vsField: average(weeks.map(week => week[side].vsField)),
    beatFieldWeeks: weeks.filter(week => week[side].vsField > 0).length,
    topPickWeeks: weeks.filter(week => week[side].topPick).length,
    best,
    worst,
  };
}

/**
 * Career numbers from the season list. Every scored week counts, the running
 * season's included; finishes and titles wait for a season to end, the same
 * rule the QB Streaming Champion badge follows.
 */
export function buildQbCareer(seasons: QbSeason[]): QbCareer {
  const oldestFirst = [...seasons].sort((a, b) => a.year - b.year);
  const weeks = oldestFirst.flatMap(season => season.weeks);
  const { best, worst } = extremes(weeks, week => week.total);

  const finishes = oldestFirst.flatMap(season =>
    !season.inProgress && season.finish
      ? [{ ...season.finish, year: season.year }]
      : [],
  );
  let bestFinish: QbCareer['bestFinish'] = null;
  for (const finish of finishes) {
    // Latest wins a tie, so a repeat champion is shown their newest title.
    if (!bestFinish || finish.rank <= bestFinish.rank) bestFinish = finish;
  }

  const running = seasons.find(season => season.inProgress);

  return {
    weeks: weeks.length,
    averageWeek: average(weeks.map(week => week.total)),
    vsField: average(weeks.map(week => week.vsField)),
    bestWeek: best,
    worstWeek: worst,
    weeklyWins: weeks.filter(week => week.rank === 1).length,
    doubledWeeks: weeks.filter(week => week.doubled).length,
    standard: sideCareer(weeks, 'standard'),
    deep: sideCareer(weeks, 'deep'),
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

/**
 * Every QB they have streamed, most picked first. A QB can move between the
 * lists over the years, so standard and deep picks are counted together, and a
 * doubled-up week is two picks. An empty slot is not a QB, so it is left out.
 */
export function buildQbExposure(weeks: QbWeek[]): QbExposureRow[] {
  const byPlayer = new Map<string, { row: QbExposureRow; points: number[] }>();

  for (const week of weeks) {
    for (const side of ['standard', 'deep'] as const) {
      const pick = week[side];
      if (pick.noPick) continue;

      const entry = byPlayer.get(pick.playerId) ?? {
        row: {
          playerId: pick.playerId,
          name: pick.name,
          picks: 0,
          standardOnly: 0,
          deepOnly: 0,
          doubled: 0,
          byYear: {},
          averagePoints: 0,
          bestPoints: pick.points,
          worstPoints: pick.points,
        },
        points: [],
      };
      if (!week.doubled) {
        entry.row[side === 'standard' ? 'standardOnly' : 'deepOnly'] += 1;
      } else if (side === 'standard') {
        entry.row.doubled += 1;
      }
      entry.row.picks += 1;
      entry.row.byYear[week.year] = (entry.row.byYear[week.year] ?? 0) + 1;
      entry.row.bestPoints = Math.max(entry.row.bestPoints, pick.points);
      entry.row.worstPoints = Math.min(entry.row.worstPoints, pick.points);
      entry.points.push(pick.points);
      byPlayer.set(pick.playerId, entry);
    }
  }

  return Array.from(byPlayer.values())
    .map(({ row, points }) => ({
      ...row,
      averagePoints: sum(points) / points.length,
    }))
    .sort(
      (a, b) =>
        b.picks - a.picks ||
        b.averagePoints - a.averagePoints ||
        a.name.localeCompare(b.name),
    );
}
