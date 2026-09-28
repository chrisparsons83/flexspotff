import { addTo, locksWeekPoints, winnersOf } from './sideGameScoring';
import { gameSlot, settledRank, type GameSlot } from './spreadPoolProfile';
import { assignCompetitionRanks } from '~/utils/rank';

/**
 * The Locks Challenge tab, worked out from rows the server has already loaded -
 * kept apart from `locks.server.ts` so the rules can be tested without a
 * database.
 *
 * Each week a member picks the winners of as many games as they like. If none
 * of them lose, every win is a point; a single loss makes the week worth
 * nothing. Ties are neither. Most points at the end of the season wins, and
 * the rules name no tiebreaker, so a tie on points is a shared title.
 *
 * Saving an entry writes a row for both teams in every game, with the sides not
 * picked marked inactive, and scoring deletes those. Callers pass scored, active
 * picks only.
 */

/** One scored pick, from anyone in the field. */
export type LocksPickRow = {
  userId: string;
  year: number;
  week: number;
  gameId: string;
  result: PickResult;
  /** Teams by abbreviation, e.g. "ATL". */
  team: string;
  opponent: string;
  isHome: boolean;
  /**
   * The Spread Pool's line on the team picked, negative when it was favored.
   * Locks has no line of its own, so this is null for the odd game the Spread
   * Pool did not offer.
   */
  spread: number | null;
  teamScore: number;
  opponentScore: number;
  kickoff: Date;
};

export type PickResult = 'win' | 'loss' | 'tie';

export type LocksRecord = { wins: number; losses: number; ties: number };

/** One of the member's picks, with where the rest of the field stood on it. */
export type LocksPick = Omit<LocksPickRow, 'userId' | 'gameId'> & {
  /** Everyone else who picked a side of this game. */
  fieldCount: number;
  /** How many of them took the same side. */
  sameSide: number;
  /** `sameSide / fieldCount`, or null when nobody else picked the game. */
  fieldShare: number | null;
  slot: GameSlot;
};

export type LocksFinish = {
  rank: number;
  fieldSize: number;
  /** Someone else finished on the same points. */
  tied: boolean;
};

export type LocksWeek = {
  year: number;
  week: number;
  record: LocksRecord;
  /** What the week scored: its wins, unless it had a loss. */
  points: number;
  /** No losses, so the wins counted. */
  clean: boolean;
  /** Wins a loss wiped out; 0 for a clean week. */
  forfeited: number;
  /** Points through this week of the season. */
  total: number;
  /** Where the week's points ranked among everyone who entered it. */
  rank: number;
  fieldSize: number;
  /** In kickoff order. */
  picks: LocksPick[];
};

/** Where the field's season totals stood after a week, for the race chart. */
export type FieldRacePoint = {
  week: number;
  low: number;
  high: number;
  /** The middle half of the field. */
  q1: number;
  q3: number;
  median: number;
};

export type LocksSeason = {
  year: number;
  inProgress: boolean;
  /** The weeks they entered, oldest first. */
  weeks: LocksWeek[];
  points: number;
  record: LocksRecord;
  cleanWeeks: number;
  forfeited: number;
  finish: LocksFinish | null;
  champion: boolean;
  bestWeek: LocksWeek | null;
  field: FieldRacePoint[];
};

export type LocksCareer = {
  seasons: number;
  completedSeasons: number;
  points: number;
  record: LocksRecord;
  weeksEntered: number;
  cleanWeeks: number;
  /** Clean weeks in a row, across seasons, counting only weeks entered. */
  longestCleanStreak: number;
  forfeited: number;
  /** Weeks with the most points of everyone who entered, and at least one. */
  weeksWon: number;
  /** The scoring week with the most points. */
  bestWeek: LocksWeek | null;
  /** The scoring week with the fewest points, above none. */
  smallestWin: LocksWeek | null;
  /** The busted week that wiped out the most wins. */
  worstBust: LocksWeek | null;
  /** The busted week one loss away from the most points. */
  nearMiss: LocksWeek | null;
  /** Busted weeks by how many losses sank them. */
  bustsByLosses: { one: number; two: number; more: number };
  bestSeason: { points: number; year: number } | null;
  worstSeason: { points: number; year: number } | null;
  titles: number;
  topThrees: number;
  bestFinish: (LocksFinish & { year: number }) | null;
  averageFinish: number | null;
  standing: (LocksFinish & { year: number }) | null;
};

/** How weeks with a given number of picks went, member and field. */
export type RiskBucket = {
  key: string;
  label: string;
  member: RiskStats;
  field: RiskStats;
};

export type RiskStats = {
  weeks: number;
  cleanWeeks: number;
  cleanRate: number | null;
  points: number;
  pointsPerWeek: number | null;
};

export type SplitStats = LocksRecord & {
  picks: number;
  winRate: number | null;
};

export type SplitBucket = {
  key: string;
  label: string;
  member: SplitStats;
  field: SplitStats;
};

export type LocksSplits = {
  side: SplitBucket[];
  line: SplitBucket[];
  venue: SplitBucket[];
  crowd: SplitBucket[];
  slot: SplitBucket[];
};

export type LocksTeamRow = {
  team: string;
  /** Picking the team to win. */
  backing: LocksRecord & { picks: number };
  /** Picking their opponent. */
  fading: LocksRecord & { picks: number };
  /** Weeks a loss by the team, picked to win, busted. */
  busts: number;
  /**
   * Wins wiped out in weeks where the team's loss was the only one - the
   * points it alone cost them.
   */
  pointsCost: number;
};

/**
 * A pick with at least this share of the field on the same side is chalk; one
 * with at most `1 - CHALK_SHARE` is contrarian.
 */
export const CHALK_SHARE = 0.7;

const sum = (values: number[]) =>
  values.reduce((total, value) => total + value, 0);

const average = (values: number[]) =>
  values.length > 0 ? sum(values) / values.length : null;

const plural = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? '' : 's'}`;

const emptyRecord = (): LocksRecord => ({ wins: 0, losses: 0, ties: 0 });

function tally(record: LocksRecord, result: PickResult) {
  if (result === 'win') record.wins += 1;
  else if (result === 'loss') record.losses += 1;
  else record.ties += 1;
}

const recordOf = (picks: { result: PickResult }[]) => {
  const record = emptyRecord();
  for (const pick of picks) tally(record, pick.result);
  return record;
};

/** Wins over decisions; a tie is neither. */
export const winRate = ({ wins, losses }: LocksRecord) =>
  wins + losses > 0 ? wins / (wins + losses) : null;

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
 * Highest by `scoreOf`. The first one seen wins a tie, so callers feed marks
 * oldest first and the earlier week keeps the record.
 */
function best<T>(marks: T[], scoreOf: (mark: T) => number): T | null {
  let top: T | null = null;
  for (const mark of marks) {
    if (top === null || scoreOf(mark) > scoreOf(top)) top = mark;
  }
  return top;
}

const weekKey = (year: number, week: number) => `${year}-${week}`;

/** One entrant's week: their picks' record and what it scored. */
type EntrantWeek = {
  userId: string;
  year: number;
  week: number;
  picks: number;
  record: LocksRecord;
  points: number;
};

type ScoringRow = Pick<LocksPickRow, 'userId' | 'year' | 'week' | 'result'>;

/** Every entrant's weeks, from the whole field's picks. */
function entrantWeeks(rows: ScoringRow[]): EntrantWeek[] {
  return Array.from(
    groupBy(rows, row => `${weekKey(row.year, row.week)}-${row.userId}`),
  ).map(([, picks]) => {
    const record = recordOf(picks);
    return {
      userId: picks[0].userId,
      year: picks[0].year,
      week: picks[0].week,
      picks: picks.length,
      record,
      points: locksWeekPoints({ isWin: record.wins, isLoss: record.losses }),
    };
  });
}

/**
 * Season points for everyone who entered each year. The standings page, the
 * finishes here and the champion badge all rank by this.
 */
export function buildSeasonTotals(
  rows: ScoringRow[],
): Map<number, Map<string, number>> {
  const byYear = new Map<number, Map<string, number>>();
  for (const week of entrantWeeks(rows)) {
    if (!byYear.has(week.year)) byYear.set(week.year, new Map());
    addTo(byYear.get(week.year)!, week.userId, week.points);
  }
  return byYear;
}

/**
 * Each pick with how much of the field was on the same side of its game.
 * "The field" is everyone else who picked that game - a member who skipped it
 * took no side.
 */
function withFieldShares<T extends LocksPickRow>(rows: T[]) {
  const byGame = groupBy(rows, row => row.gameId);

  return rows.map(row => {
    const others = (byGame.get(row.gameId) ?? []).filter(
      other => other.userId !== row.userId,
    );
    const sameSide = others.filter(other => other.team === row.team).length;
    return {
      ...row,
      fieldCount: others.length,
      sameSide,
      fieldShare: others.length > 0 ? sameSide / others.length : null,
      slot: gameSlot(row.kickoff),
    };
  });
}

/** The member's picks, oldest first, each with where the field stood. */
export function buildLocksPicks(
  rows: LocksPickRow[],
  userId: string,
): LocksPick[] {
  return withFieldShares(rows)
    .filter(row => row.userId === userId)
    .map(({ userId: _userId, gameId: _gameId, ...pick }) => pick)
    .sort(
      (a, b) =>
        a.year - b.year ||
        a.week - b.week ||
        a.kickoff.getTime() - b.kickoff.getTime() ||
        a.team.localeCompare(b.team),
    );
}

/**
 * The member's weeks, oldest first, each ranked against everyone who entered
 * it and with the season's running total.
 */
export function buildLocksWeeks({
  picks,
  rows,
  userId,
}: {
  /** The member's, from `buildLocksPicks`. */
  picks: LocksPick[];
  /** The whole field's, for ranking each week. */
  rows: LocksPickRow[];
  userId: string;
}): LocksWeek[] {
  const fieldPoints = groupBy(entrantWeeks(rows), week =>
    weekKey(week.year, week.week),
  );
  const totals = new Map<number, number>();

  return Array.from(
    groupBy(picks, pick => weekKey(pick.year, pick.week)).values(),
  )
    .sort((a, b) => a[0].year - b[0].year || a[0].week - b[0].week)
    .map(weekPicks => {
      const { year, week } = weekPicks[0];
      const record = recordOf(weekPicks);
      const points = locksWeekPoints({
        isWin: record.wins,
        isLoss: record.losses,
      });
      const total = (totals.get(year) ?? 0) + points;
      totals.set(year, total);

      const ranked = assignCompetitionRanks(
        [...(fieldPoints.get(weekKey(year, week)) ?? [])].sort(
          (a, b) => b.points - a.points,
        ),
        entry => entry.points,
      );

      return {
        year,
        week,
        record,
        points,
        clean: record.losses === 0,
        forfeited: record.losses > 0 ? record.wins : 0,
        total,
        rank: ranked.find(entry => entry.userId === userId)?.rank ?? 1,
        fieldSize: ranked.length,
        picks: weekPicks,
      };
    });
}

/** Linear interpolation between the closest ranks, as spreadsheets do it. */
function quantile(sorted: number[], q: number) {
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

/**
 * Where every entrant's season total stood after each week of one season.
 * Someone who skipped a week keeps the total they had, and everyone who
 * entered the season is in the field from week one.
 */
export function buildFieldRace(rows: ScoringRow[]): FieldRacePoint[] {
  const weeks = entrantWeeks(rows);
  const members = new Set(weeks.map(week => week.userId));
  const totals = new Map(Array.from(members).map(member => [member, 0]));
  const byWeek = groupBy(weeks, week => week.week);

  return Array.from(byWeek.keys())
    .sort((a, b) => a - b)
    .map(week => {
      for (const entry of byWeek.get(week)!) {
        totals.set(entry.userId, totals.get(entry.userId)! + entry.points);
      }
      const sorted = Array.from(totals.values()).sort((a, b) => a - b);
      return {
        week,
        low: sorted[0],
        high: sorted[sorted.length - 1],
        q1: quantile(sorted, 0.25),
        q3: quantile(sorted, 0.75),
        median: quantile(sorted, 0.5),
      };
    });
}

/** One entry per season the member played, newest first. */
export function buildLocksSeasons({
  weeks,
  totals,
  fieldRaces,
  userId,
  inProgressYear,
}: {
  weeks: LocksWeek[];
  /** From `buildSeasonTotals`, for the finishes. */
  totals: Map<number, Map<string, number>>;
  fieldRaces: Map<number, FieldRacePoint[]>;
  userId: string;
  inProgressYear: number | null;
}): LocksSeason[] {
  return Array.from(groupBy(weeks, week => week.year).entries())
    .map(([year, yearWeeks]) => {
      const inProgress = year === inProgressYear;
      const yearTotals = totals.get(year) ?? new Map<string, number>();
      const ranked = assignCompetitionRanks(
        Array.from(yearTotals.entries())
          .map(([entrant, total]) => ({ userId: entrant, total }))
          .sort((a, b) => b.total - a.total),
        entry => entry.total,
      );
      const mine = ranked.find(entry => entry.userId === userId);

      return {
        year,
        inProgress,
        weeks: yearWeeks,
        points: sum(yearWeeks.map(week => week.points)),
        record: recordOf(yearWeeks.flatMap(week => week.picks)),
        cleanWeeks: yearWeeks.filter(week => week.clean).length,
        forfeited: sum(yearWeeks.map(week => week.forfeited)),
        finish: mine
          ? {
              rank: mine.rank,
              fieldSize: ranked.length,
              tied: ranked.filter(entry => entry.rank === mine.rank).length > 1,
            }
          : null,
        // The badge's rule: a tie on points shares the title.
        champion: !inProgress && winnersOf(yearTotals).has(userId),
        bestWeek: best(
          yearWeeks.filter(week => week.points > 0),
          week => week.points,
        ),
        field: fieldRaces.get(year) ?? [],
      };
    })
    .sort((a, b) => b.year - a.year);
}

/**
 * Career numbers from the season list. Every scored pick counts, the running
 * season's included; finishes and titles wait for a season to end, the same
 * rule the Locks Champion badge follows.
 *
 * Ties for a best or worst week go to the earlier one.
 */
export function buildLocksCareer(seasons: LocksSeason[]): LocksCareer {
  const oldestFirst = [...seasons].sort((a, b) => a.year - b.year);
  const weeks = oldestFirst.flatMap(season => season.weeks);
  const record = recordOf(weeks.flatMap(week => week.picks));
  const scoring = weeks.filter(week => week.points > 0);
  const busts = weeks.filter(week => !week.clean);

  let streak = 0;
  let longestCleanStreak = 0;
  for (const week of weeks) {
    streak = week.clean ? streak + 1 : 0;
    longestCleanStreak = Math.max(longestCleanStreak, streak);
  }

  const completed = oldestFirst.filter(season => !season.inProgress);
  const bestSeason = best(completed, season => season.points);
  const worstSeason = best(completed, season => -season.points);
  const finishes = completed.flatMap(season =>
    season.finish
      ? [{ ...season.finish, rank: settledRank(season)!, year: season.year }]
      : [],
  );
  let bestFinish: LocksCareer['bestFinish'] = null;
  for (const finish of finishes) {
    // Latest wins a tie, so a repeat champion is shown their newest title.
    if (!bestFinish || finish.rank <= bestFinish.rank) bestFinish = finish;
  }
  const running = seasons.find(season => season.inProgress);

  return {
    seasons: seasons.length,
    completedSeasons: completed.length,
    points: sum(weeks.map(week => week.points)),
    record,
    weeksEntered: weeks.length,
    cleanWeeks: weeks.filter(week => week.clean).length,
    longestCleanStreak,
    forfeited: sum(weeks.map(week => week.forfeited)),
    weeksWon: weeks.filter(week => week.rank === 1 && week.points > 0).length,
    bestWeek: best(scoring, week => week.points),
    smallestWin: best(scoring, week => -week.points),
    worstBust: best(
      busts.filter(week => week.forfeited > 0),
      week => week.forfeited,
    ),
    nearMiss: best(
      busts.filter(week => week.record.losses === 1 && week.forfeited > 0),
      week => week.forfeited,
    ),
    bustsByLosses: {
      one: busts.filter(week => week.record.losses === 1).length,
      two: busts.filter(week => week.record.losses === 2).length,
      more: busts.filter(week => week.record.losses > 2).length,
    },
    bestSeason: bestSeason && {
      points: bestSeason.points,
      year: bestSeason.year,
    },
    worstSeason: worstSeason && {
      points: worstSeason.points,
      year: worstSeason.year,
    },
    titles: completed.filter(season => season.champion).length,
    topThrees: finishes.filter(finish => finish.rank <= 3).length,
    bestFinish,
    averageFinish: average(finishes.map(finish => finish.rank)),
    standing:
      running?.finish != null
        ? { ...running.finish, year: running.year }
        : null,
  };
}

function riskStats(weeks: { points: number; clean: boolean }[]): RiskStats {
  const cleanWeeks = weeks.filter(week => week.clean).length;
  const points = sum(weeks.map(week => week.points));
  return {
    weeks: weeks.length,
    cleanWeeks,
    cleanRate: weeks.length > 0 ? cleanWeeks / weeks.length : null,
    points,
    pointsPerWeek: weeks.length > 0 ? points / weeks.length : null,
  };
}

/**
 * The member's weeks by how many picks went into them, next to everyone
 * else's in the same seasons. The more picks, the more a scoring week is worth
 * and the likelier a loss wipes it out - this is where a member's appetite for
 * that trade shows. One row per number of picks the member has made.
 */
export function buildRiskProfile(
  weeks: LocksWeek[],
  rows: LocksPickRow[],
  userId: string,
): RiskBucket[] {
  const others = entrantWeeks(rows.filter(row => row.userId !== userId)).map(
    week => ({
      picks: week.picks,
      points: week.points,
      clean: week.record.losses === 0,
    }),
  );
  const mine = weeks.map(week => ({
    picks: week.picks.length,
    points: week.points,
    clean: week.clean,
  }));

  return Array.from(new Set(mine.map(week => week.picks)))
    .sort((a, b) => a - b)
    .map(count => {
      const withCount = (week: { picks: number }) => week.picks === count;
      return {
        key: String(count),
        label: plural(count, 'pick'),
        member: riskStats(mine.filter(withCount)),
        field: riskStats(others.filter(withCount)),
      };
    });
}

type SplitInput = Pick<
  LocksPick,
  'result' | 'spread' | 'isHome' | 'slot' | 'fieldShare'
>;

type SplitDefinition = {
  key: string;
  label: string;
  matches: (pick: SplitInput) => boolean;
};

const SIDE_BUCKETS: SplitDefinition[] = [
  {
    key: 'favorite',
    label: 'Favorites',
    matches: p => p.spread !== null && p.spread < 0,
  },
  {
    key: 'underdog',
    label: 'Underdogs',
    matches: p => p.spread !== null && p.spread > 0,
  },
  { key: 'pick', label: 'Pick’em', matches: p => p.spread === 0 },
  { key: 'none', label: 'No line', matches: p => p.spread === null },
];

/**
 * The line on the team picked, bucketed. Picking winners leans hard on
 * favorites, so they get the finer buckets.
 */
const LINE_BUCKETS: SplitDefinition[] = [
  {
    key: 'hugeFav',
    label: 'Fav by 10+',
    matches: p => p.spread !== null && p.spread <= -10,
  },
  {
    key: 'bigFav',
    label: 'Fav by 7–9.5',
    matches: p => p.spread !== null && p.spread > -10 && p.spread <= -7,
  },
  {
    key: 'fav',
    label: 'Fav by 3.5–6.5',
    matches: p => p.spread !== null && p.spread > -7 && p.spread <= -3.5,
  },
  {
    key: 'smallFav',
    label: 'Fav by 0.5–3',
    matches: p => p.spread !== null && p.spread > -3.5 && p.spread < 0,
  },
  { key: 'pick', label: 'Pick’em', matches: p => p.spread === 0 },
  {
    key: 'smallDog',
    label: 'Dog by 0.5–3',
    matches: p => p.spread !== null && p.spread > 0 && p.spread < 3.5,
  },
  {
    key: 'dog',
    label: 'Dog by 3.5+',
    matches: p => p.spread !== null && p.spread >= 3.5,
  },
];

const VENUE_BUCKETS: SplitDefinition[] = [
  { key: 'home', label: 'Home', matches: p => p.isHome },
  { key: 'away', label: 'Away', matches: p => !p.isHome },
];

const CROWD_BUCKETS: SplitDefinition[] = [
  {
    key: 'chalk',
    label: 'Chalk',
    matches: p => p.fieldShare !== null && p.fieldShare >= CHALK_SHARE,
  },
  {
    key: 'split',
    label: 'Split field',
    matches: p =>
      p.fieldShare !== null &&
      p.fieldShare < CHALK_SHARE &&
      p.fieldShare > 1 - CHALK_SHARE,
  },
  {
    key: 'contrarian',
    label: 'Contrarian',
    matches: p => p.fieldShare !== null && p.fieldShare <= 1 - CHALK_SHARE,
  },
  {
    key: 'alone',
    label: 'Only one on the game',
    matches: p => p.fieldShare === null,
  },
];

/**
 * In the order of an NFL week: the Wednesday openers and Christmas games first,
 * through to Monday night, with Tuesday - the odd rescheduled game - last.
 */
const SLOT_BUCKETS: SplitDefinition[] = (
  [
    ['wednesday', 'Wednesday'],
    ['thursday', 'Thursday'],
    ['friday', 'Friday'],
    ['saturday', 'Saturday'],
    ['sundayEarly', 'Sunday early'],
    ['sundayLate', 'Sunday late'],
    ['sundayNight', 'Sunday night'],
    ['monday', 'Monday'],
    ['tuesday', 'Tuesday'],
  ] as const
).map(([key, label]) => ({ key, label, matches: p => p.slot === key }));

function splitStats(picks: SplitInput[]): SplitStats {
  const record = recordOf(picks);
  return { ...record, picks: picks.length, winRate: winRate(record) };
}

/**
 * Only the buckets the member picked in, unless `keep` says otherwise - the
 * side split keeps the field's too, since its share is taken over all of them.
 */
function split(
  definitions: SplitDefinition[],
  member: SplitInput[],
  field: SplitInput[],
  keep: (bucket: SplitBucket) => boolean = bucket => bucket.member.picks > 0,
): SplitBucket[] {
  return definitions
    .map(({ key, label, matches }) => ({
      key,
      label,
      member: splitStats(member.filter(matches)),
      field: splitStats(field.filter(matches)),
    }))
    .filter(keep);
}

/**
 * How the member picks, next to how everyone else in the same seasons picked.
 * The field is everyone else's picks, so the member is not measured against
 * themselves - and each of theirs has its own crowd share, so chalk and
 * contrarian compare like with like.
 */
export function buildLocksSplits(
  mine: LocksPick[],
  rows: LocksPickRow[],
  userId: string,
): LocksSplits {
  const others = withFieldShares(rows).filter(row => row.userId !== userId);

  return {
    // Every bucket either side used, so the field's share on favorites is out
    // of all its picks, not just the kinds the member happened to make.
    side: split(
      SIDE_BUCKETS,
      mine,
      others,
      bucket => bucket.member.picks > 0 || bucket.field.picks > 0,
    ),
    line: split(LINE_BUCKETS, mine, others),
    venue: split(VENUE_BUCKETS, mine, others),
    crowd: split(CROWD_BUCKETS, mine, others),
    slot: split(SLOT_BUCKETS, mine, others),
  };
}

/**
 * Every team they have picked or picked against, most picked first. A busted
 * week is pinned on every team that lost in it; its points only on a team that
 * was the week's sole loss, since otherwise winning would not have saved it.
 */
export function buildLocksTeams(weeks: LocksWeek[]): LocksTeamRow[] {
  const byTeam = new Map<string, LocksTeamRow>();
  const rowFor = (team: string) => {
    const existing = byTeam.get(team);
    if (existing) return existing;
    const row: LocksTeamRow = {
      team,
      backing: { ...emptyRecord(), picks: 0 },
      fading: { ...emptyRecord(), picks: 0 },
      busts: 0,
      pointsCost: 0,
    };
    byTeam.set(team, row);
    return row;
  };

  for (const week of weeks) {
    for (const pick of week.picks) {
      const backing = rowFor(pick.team);
      tally(backing.backing, pick.result);
      backing.backing.picks += 1;

      const fading = rowFor(pick.opponent);
      tally(fading.fading, pick.result);
      fading.fading.picks += 1;

      if (pick.result === 'loss') {
        backing.busts += 1;
        if (week.record.losses === 1) backing.pointsCost += week.forfeited;
      }
    }
  }

  return Array.from(byTeam.values()).sort(
    (a, b) =>
      b.backing.picks - a.backing.picks ||
      b.backing.wins - a.backing.wins ||
      a.team.localeCompare(b.team),
  );
}
