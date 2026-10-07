import { addTo, winnersOf } from './sideGameScoring';
import { assignCompetitionRanks } from '~/utils/rank';

/**
 * The Spread Pool tab, worked out from rows the server has already loaded -
 * kept apart from `spreadPool.server.ts` so the rules can be tested without a
 * database.
 *
 * Everyone starts a season with a 1000-point bank and bets on NFL games against
 * the spread, at even money, up to 50 a game. A week with no bets costs 20.
 *
 * Saving an entry writes a row for every team in every game, with 0 against the
 * sides that were not bet, and scoring marks those rows won or lost like any
 * other. Only rows with something riding on them are bets: the rest would count
 * every game a member skipped as a win and a loss. Callers pass bets only.
 */

export const STARTING_BANK = 1000;
export const MAX_BET = 50;

/** One scored bet, from anyone in the field. */
export type PoolBetRow = {
  userId: string;
  year: number;
  week: number;
  gameId: string;
  amount: number;
  /** What the bet won or lost; 0 for a push. */
  net: number;
  result: BetResult;
  /** Teams by abbreviation, e.g. "ATL". */
  team: string;
  opponent: string;
  isHome: boolean;
  /** The line on the team bet: negative when it was giving points. */
  spread: number;
  teamScore: number;
  opponentScore: number;
  kickoff: Date;
};

/** A week with no bets in it, and the penalty it cost. */
export type PoolMissedRow = {
  userId: string;
  year: number;
  week: number;
  net: number;
};

export type BetResult = 'win' | 'loss' | 'push';

export type Record3 = { wins: number; losses: number; pushes: number };

/**
 * One of the member's bets. Who placed it and which game it was are dropped:
 * a member bets hundreds of times, and the page has no use for either.
 */
export type PoolBet = Omit<PoolBetRow, 'userId' | 'gameId'> & {
  /** Points the bet beat (or missed) the line by. 0 is a push. */
  coverMargin: number;
  /**
   * Share of everyone else who bet the game that took the same side, or null
   * when nobody else bet it.
   */
  fieldShare: number | null;
  slot: GameSlot;
};

export type PoolFinish = { rank: number; fieldSize: number };

export type PoolWeek = {
  year: number;
  week: number;
  missed: boolean;
  net: number;
  /** The bank once the week was settled. */
  bank: number;
  wagered: number;
  record: Record3;
  /** Where the week's net ranked among everyone with a result that week. */
  rank: number;
  fieldSize: number;
  /** Biggest first, then by kickoff. */
  bets: PoolBet[];
};

/** Where the field's banks stood after a week, for the bankroll chart. */
export type FieldBankPoint = {
  week: number;
  low: number;
  high: number;
  /** The middle half of the field. */
  q1: number;
  q3: number;
  median: number;
};

export type PoolSeason = {
  year: number;
  inProgress: boolean;
  /** Oldest first. */
  weeks: PoolWeek[];
  net: number;
  bank: number;
  wagered: number;
  record: Record3;
  /** Net over amount wagered, as on the standings page. */
  roe: number | null;
  missedWeeks: number;
  finish: PoolFinish | null;
  champion: boolean;
  bestWeek: PoolWeek | null;
  worstWeek: PoolWeek | null;
  field: FieldBankPoint[];
};

export type PoolCareer = {
  seasons: number;
  completedSeasons: number;
  net: number;
  wagered: number;
  roe: number | null;
  bets: number;
  record: Record3;
  winRate: number | null;
  bestBank: { bank: number; year: number } | null;
  worstBank: { bank: number; year: number } | null;
  /** Finished seasons that ended above the starting bank. */
  profitableSeasons: number;
  titles: number;
  topThrees: number;
  bestFinish: (PoolFinish & { year: number }) | null;
  averageFinish: number | null;
  standing: (PoolFinish & { year: number }) | null;
  weeksPlayed: number;
  averageBet: number | null;
  /** Bets of the full amount a game allows. */
  maxBets: number;
  /**
   * How the weeks they bet in finished. Missed weeks are counted on their
   * own, so up, down and even add up to `weeksPlayed`.
   */
  weeks: Record3;
  bestWeek: PoolWeek | null;
  worstWeek: PoolWeek | null;
};

export type PoolTeamRow = {
  team: string;
  backing: Record3 & { bets: number; net: number };
  fading: Record3 & { bets: number; net: number };
  net: number;
};

export type SplitStats = Record3 & {
  bets: number;
  net: number;
  wagered: number;
  winRate: number | null;
};

export type SplitBucket = {
  key: string;
  label: string;
  member: SplitStats;
  field: SplitStats;
};

export type PoolSplits = {
  side: SplitBucket[];
  line: SplitBucket[];
  size: SplitBucket[];
  venue: SplitBucket[];
  crowd: SplitBucket[];
  slot: SplitBucket[];
};

export type GameSlot =
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sundayEarly'
  | 'sundayLate'
  | 'sundayNight'
  | 'monday'
  | 'tuesday'
  | 'wednesday';

const sum = (values: number[]) =>
  values.reduce((total, value) => total + value, 0);

const average = (values: number[]) =>
  values.length > 0 ? sum(values) / values.length : null;

const emptyRecord = (): Record3 => ({ wins: 0, losses: 0, pushes: 0 });

function tally(record: Record3, result: BetResult) {
  if (result === 'win') record.wins += 1;
  else if (result === 'loss') record.losses += 1;
  else record.pushes += 1;
}

/** Wins over decisions; a push is neither. */
export const winRate = ({ wins, losses }: Record3) =>
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

const easternParts = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  weekday: 'short',
  hour: 'numeric',
  hourCycle: 'h23',
});

/**
 * Which window a game kicked off in, by the clock in New York. Sunday splits at
 * 3pm, between the 1pm and 4pm slates, and the London morning games go in with
 * the early ones. Every other day is its own window - the December Saturdays,
 * Black Friday, Christmas, and the odd Friday or Wednesday opener.
 */
/** Every day but Sunday, by its short name in `easternParts`. */
const WEEKDAY_SLOTS: Record<string, GameSlot> = {
  Mon: 'monday',
  Tue: 'tuesday',
  Wed: 'wednesday',
  Thu: 'thursday',
  Fri: 'friday',
  Sat: 'saturday',
};

export function gameSlot(kickoff: Date): GameSlot {
  const parts = easternParts.formatToParts(kickoff);
  const weekday = parts.find(part => part.type === 'weekday')?.value;
  const hour = Number(parts.find(part => part.type === 'hour')?.value ?? 0);

  if (weekday !== 'Sun') return WEEKDAY_SLOTS[weekday!];
  if (hour >= 19) return 'sundayNight';
  return hour >= 15 ? 'sundayLate' : 'sundayEarly';
}

/**
 * Season totals for everyone who bet each year: net won and lost, including
 * the penalty for a missed week. The standings page, the finishes here and the
 * champion badge all rank by this.
 *
 * A member only counts once they have placed a scored bet that season. Saving
 * an entry charges every week before it that had no bets, so someone who saves
 * one and then zeroes it out has penalties and nothing else - and a penalty
 * alone should not put them in the standings.
 */
export function buildSeasonTotals(
  bets: Pick<PoolBetRow, 'userId' | 'year' | 'net'>[],
  missed: Pick<PoolMissedRow, 'userId' | 'year' | 'net'>[],
): Map<number, Map<string, number>> {
  const byYear = new Map<number, Map<string, number>>();
  for (const bet of bets) {
    if (!byYear.has(bet.year)) byYear.set(bet.year, new Map());
    addTo(byYear.get(bet.year)!, bet.userId, bet.net);
  }
  for (const week of missed) {
    const totals = byYear.get(week.year);
    if (totals?.has(week.userId)) addTo(totals, week.userId, week.net);
  }
  return byYear;
}

/**
 * The member's bets, each with how it covered and how much of the field was
 * on the same side. `rows` must hold the whole field for every game the member
 * bet.
 */
export function buildPoolBets(rows: PoolBetRow[], userId: string): PoolBet[] {
  const byGame = groupBy(rows, row => row.gameId);

  return rows
    .filter(row => row.userId === userId)
    .map(row => {
      const others = (byGame.get(row.gameId) ?? []).filter(
        other => other.userId !== userId,
      );
      const sameSide = others.filter(other => other.team === row.team).length;
      const { userId: _userId, gameId: _gameId, ...bet } = row;

      return {
        ...bet,
        coverMargin: row.teamScore + row.spread - row.opponentScore,
        fieldShare: others.length > 0 ? sameSide / others.length : null,
        slot: gameSlot(row.kickoff),
      };
    })
    .sort(
      (a, b) =>
        a.year - b.year ||
        a.week - b.week ||
        a.kickoff.getTime() - b.kickoff.getTime(),
    );
}

/**
 * The member's weeks, oldest first, with the bank running through each season.
 * A week counts if they bet in it or were charged for missing it.
 */
export function buildPoolWeeks({
  bets,
  rows,
  missed,
  userId,
}: {
  /** The member's, from `buildPoolBets`. */
  bets: PoolBet[];
  /** The whole field's, for ranking each week. */
  rows: PoolBetRow[];
  missed: PoolMissedRow[];
  userId: string;
}): PoolWeek[] {
  // Every member's net for every week, to rank the member's against. A
  // penalty only counts for someone who bet that season, the same field the
  // season totals rank.
  const bettors = new Set(rows.map(row => `${row.year}-${row.userId}`));
  const fieldNets = new Map<string, Map<string, number>>();
  const forWeek = (year: number, week: number) => {
    const key = weekKey(year, week);
    if (!fieldNets.has(key)) fieldNets.set(key, new Map());
    return fieldNets.get(key)!;
  };
  for (const row of rows)
    addTo(forWeek(row.year, row.week), row.userId, row.net);
  for (const week of missed) {
    if (!bettors.has(`${week.year}-${week.userId}`)) continue;
    addTo(forWeek(week.year, week.week), week.userId, week.net);
  }

  const betsByWeek = groupBy(bets, bet => weekKey(bet.year, bet.week));
  const mine = [
    ...Array.from(betsByWeek.values()).map(weekBets => ({
      year: weekBets[0].year,
      week: weekBets[0].week,
      missed: false,
      bets: weekBets,
      net: sum(weekBets.map(bet => bet.net)),
    })),
    ...missed
      .filter(week => week.userId === userId)
      .filter(week => !betsByWeek.has(weekKey(week.year, week.week)))
      .map(week => ({
        year: week.year,
        week: week.week,
        missed: true,
        bets: [] as PoolBet[],
        net: week.net,
      })),
  ].sort((a, b) => a.year - b.year || a.week - b.week);

  const banks = new Map<number, number>();

  return mine.map(week => {
    const bank = (banks.get(week.year) ?? STARTING_BANK) + week.net;
    banks.set(week.year, bank);

    const ranked = assignCompetitionRanks(
      Array.from(forWeek(week.year, week.week).entries())
        .map(([entrant, net]) => ({ userId: entrant, net }))
        .sort((a, b) => b.net - a.net),
      entry => entry.net,
    );
    const record = emptyRecord();
    for (const bet of week.bets) tally(record, bet.result);

    return {
      year: week.year,
      week: week.week,
      missed: week.missed,
      net: week.net,
      bank,
      wagered: sum(week.bets.map(bet => bet.amount)),
      record,
      rank: ranked.find(entry => entry.userId === userId)?.rank ?? 1,
      fieldSize: ranked.length,
      bets: [...week.bets].sort(
        (a, b) =>
          b.amount - a.amount || a.kickoff.getTime() - b.kickoff.getTime(),
      ),
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
 * Where every bank in the field stood after each week of a season. A member
 * with nothing that week - before their first bet, say - keeps the bank they
 * had.
 */
export function buildFieldBanks(
  rows: Pick<PoolBetRow, 'userId' | 'week' | 'net'>[],
  missed: Pick<PoolMissedRow, 'userId' | 'week' | 'net'>[],
): FieldBankPoint[] {
  const members = new Set(rows.map(row => row.userId));
  const nets = new Map<number, Map<string, number>>();
  for (const entry of [...rows, ...missed]) {
    if (!members.has(entry.userId)) continue;
    if (!nets.has(entry.week)) nets.set(entry.week, new Map());
    addTo(nets.get(entry.week)!, entry.userId, entry.net);
  }

  const banks = new Map(
    Array.from(members).map(member => [member, STARTING_BANK]),
  );

  return Array.from(nets.keys())
    .sort((a, b) => a - b)
    .map(week => {
      for (const [member, net] of nets.get(week)!) {
        banks.set(member, banks.get(member)! + net);
      }
      const sorted = Array.from(banks.values()).sort((a, b) => a - b);
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
export function buildPoolSeasons({
  weeks,
  totals,
  fieldBanks,
  userId,
  inProgressYear,
}: {
  weeks: PoolWeek[];
  /** From `buildSeasonTotals`, for the finishes. */
  totals: Map<number, Map<string, number>>;
  fieldBanks: Map<number, FieldBankPoint[]>;
  userId: string;
  inProgressYear: number | null;
}): PoolSeason[] {
  return Array.from(groupBy(weeks, week => week.year).entries())
    .map(([year, yearWeeks]) => {
      const bets = yearWeeks.flatMap(week => week.bets);
      const record = emptyRecord();
      for (const bet of bets) tally(record, bet.result);
      const net = sum(yearWeeks.map(week => week.net));
      const wagered = sum(bets.map(bet => bet.amount));
      const inProgress = year === inProgressYear;

      const yearTotals = totals.get(year) ?? new Map<string, number>();
      const ranked = assignCompetitionRanks(
        Array.from(yearTotals.entries())
          .map(([entrant, total]) => ({ userId: entrant, total }))
          .sort((a, b) => b.total - a.total),
        entry => entry.total,
      );
      const mine = ranked.find(entry => entry.userId === userId);
      const { best, worst } = extremes(yearWeeks, week => week.net);

      return {
        year,
        inProgress,
        weeks: yearWeeks,
        net,
        bank: STARTING_BANK + net,
        wagered,
        record,
        roe: wagered > 0 ? net / wagered : null,
        missedWeeks: yearWeeks.filter(week => week.missed).length,
        finish: mine ? { rank: mine.rank, fieldSize: ranked.length } : null,
        // The badge's rule, so a winless season can never read as a title.
        champion: !inProgress && winnersOf(yearTotals).has(userId),
        bestWeek: best,
        worstWeek: worst,
        field: fieldBanks.get(year) ?? [],
      };
    })
    .sort((a, b) => b.year - a.year);
}

/**
 * A finished season's place for the career numbers. Topping a season that
 * everyone lost is not a title - the badge's rule - so it counts as a 2nd,
 * rather than a 1st that no trophy goes with.
 */
export function settledRank(
  season: Pick<PoolSeason, 'finish' | 'champion'>,
): number | null {
  if (!season.finish) return null;
  return season.champion ? 1 : Math.max(season.finish.rank, 2);
}

/**
 * Career numbers from the season list. Every scored bet counts, the running
 * season's included; finishes and titles wait for a season to end, the same
 * rule the Spread Pool Champion badge follows.
 */
export function buildPoolCareer(seasons: PoolSeason[]): PoolCareer {
  const oldestFirst = [...seasons].sort((a, b) => a.year - b.year);
  const weeks = oldestFirst.flatMap(season => season.weeks);
  const bets = weeks.flatMap(week => week.bets);
  const record = emptyRecord();
  for (const bet of bets) tally(record, bet.result);

  const net = sum(oldestFirst.map(season => season.net));
  const wagered = sum(bets.map(bet => bet.amount));

  const completed = oldestFirst.filter(season => !season.inProgress);
  const banks = extremes(completed, season => season.bank);
  const finishes = completed.flatMap(season =>
    season.finish
      ? [{ ...season.finish, rank: settledRank(season)!, year: season.year }]
      : [],
  );
  let bestFinish: PoolCareer['bestFinish'] = null;
  for (const finish of finishes) {
    // Latest wins a tie, so a repeat champion is shown their newest title.
    if (!bestFinish || finish.rank <= bestFinish.rank) bestFinish = finish;
  }
  const running = seasons.find(season => season.inProgress);
  const missedWeeks = weeks.filter(week => week.missed);
  const played = weeks.filter(week => !week.missed);
  const { best, worst } = extremes(played, week => week.net);

  return {
    seasons: seasons.length,
    completedSeasons: completed.length,
    net,
    wagered,
    roe: wagered > 0 ? net / wagered : null,
    bets: bets.length,
    record,
    winRate: winRate(record),
    bestBank: banks.best && { bank: banks.best.bank, year: banks.best.year },
    worstBank: banks.worst && {
      bank: banks.worst.bank,
      year: banks.worst.year,
    },
    profitableSeasons: completed.filter(season => season.net > 0).length,
    titles: completed.filter(season => season.champion).length,
    topThrees: finishes.filter(finish => finish.rank <= 3).length,
    bestFinish,
    averageFinish: average(finishes.map(finish => finish.rank)),
    standing:
      running?.finish != null
        ? { ...running.finish, year: running.year }
        : null,
    weeksPlayed: weeks.length - missedWeeks.length,
    averageBet: average(bets.map(bet => bet.amount)),
    maxBets: bets.filter(bet => bet.amount >= MAX_BET).length,
    weeks: {
      wins: played.filter(week => week.net > 0).length,
      losses: played.filter(week => week.net < 0).length,
      pushes: played.filter(week => week.net === 0).length,
    },
    bestWeek: best,
    worstWeek: worst,
  };
}

/**
 * Every team they have bet on or against, most net won first. Backing and
 * fading are kept apart: a member who always loses on a team and always wins
 * against it nets to nothing, and that is the interesting thing about them.
 */
export function buildPoolTeams(bets: PoolBet[]): PoolTeamRow[] {
  const byTeam = new Map<string, PoolTeamRow>();
  const rowFor = (team: string) => {
    const existing = byTeam.get(team);
    if (existing) return existing;
    const row: PoolTeamRow = {
      team,
      backing: { ...emptyRecord(), bets: 0, net: 0 },
      fading: { ...emptyRecord(), bets: 0, net: 0 },
      net: 0,
    };
    byTeam.set(team, row);
    return row;
  };

  for (const bet of bets) {
    for (const [team, side] of [
      [bet.team, 'backing'],
      [bet.opponent, 'fading'],
    ] as const) {
      const row = rowFor(team);
      tally(row[side], bet.result);
      row[side].bets += 1;
      row[side].net += bet.net;
      row.net += bet.net;
    }
  }

  return Array.from(byTeam.values()).sort(
    (a, b) =>
      b.net - a.net ||
      b.backing.bets + b.fading.bets - (a.backing.bets + a.fading.bets) ||
      a.team.localeCompare(b.team),
  );
}

/**
 * What a bet needs to be bucketed. The field's bets have no `fieldShare`: it is
 * only worked out for the member's.
 */
type SplitInput = Pick<
  PoolBet,
  'result' | 'net' | 'amount' | 'spread' | 'isHome' | 'slot'
> & { fieldShare?: number | null };

type SplitDefinition = {
  key: string;
  label: string;
  matches: (bet: SplitInput) => boolean;
};

/**
 * The line on the team bet, bucketed. A half point either side of 3 and 7 is
 * where most games land, so those are the edges.
 */
const LINE_BUCKETS: SplitDefinition[] = [
  { key: 'bigFav', label: 'Fav by 7.5+', matches: b => b.spread <= -7.5 },
  {
    key: 'fav',
    label: 'Fav by 3.5–7',
    matches: b => b.spread > -7.5 && b.spread <= -3.5,
  },
  {
    key: 'smallFav',
    label: 'Fav by 0.5–3',
    matches: b => b.spread > -3.5 && b.spread < 0,
  },
  { key: 'pick', label: 'Pick’em', matches: b => b.spread === 0 },
  {
    key: 'smallDog',
    label: 'Dog by 0.5–3',
    matches: b => b.spread > 0 && b.spread < 3.5,
  },
  {
    key: 'dog',
    label: 'Dog by 3.5–7',
    matches: b => b.spread >= 3.5 && b.spread < 7.5,
  },
  { key: 'bigDog', label: 'Dog by 7.5+', matches: b => b.spread >= 7.5 },
];

const SIDE_BUCKETS: SplitDefinition[] = [
  { key: 'favorite', label: 'Favorites', matches: b => b.spread < 0 },
  { key: 'underdog', label: 'Underdogs', matches: b => b.spread > 0 },
  { key: 'pick', label: 'Pick’em', matches: b => b.spread === 0 },
];

/** The entry form steps bets by 10, so every size gets a row of its own. */
const SIZE_BUCKETS: SplitDefinition[] = [10, 20, 30, 40, MAX_BET].map(
  (amount, index, all) => ({
    key: String(amount),
    label: amount === MAX_BET ? `${amount} (max)` : String(amount),
    // Anything off the steps rounds up into the next one.
    matches: b => b.amount <= amount && b.amount > (all[index - 1] ?? 0),
  }),
);

const VENUE_BUCKETS: SplitDefinition[] = [
  { key: 'home', label: 'Home', matches: b => b.isHome },
  { key: 'away', label: 'Away', matches: b => !b.isHome },
];

const CROWD_BUCKETS: SplitDefinition[] = [
  {
    key: 'with',
    label: 'With the crowd',
    matches: b => b.fieldShare != null && b.fieldShare > 0.5,
  },
  {
    key: 'split',
    label: 'Split field',
    matches: b => b.fieldShare === 0.5,
  },
  {
    key: 'against',
    label: 'Against the crowd',
    matches: b => b.fieldShare != null && b.fieldShare < 0.5,
  },
];

/**
 * In the order of an NFL week: the Wednesday openers and Christmas games first,
 * through to Monday night, with Tuesday - the odd rescheduled game - last.
 */
const SLOT_BUCKETS: SplitDefinition[] = [
  {
    key: 'wednesday',
    label: 'Wednesday',
    matches: b => b.slot === 'wednesday',
  },
  { key: 'thursday', label: 'Thursday', matches: b => b.slot === 'thursday' },
  { key: 'friday', label: 'Friday', matches: b => b.slot === 'friday' },
  { key: 'saturday', label: 'Saturday', matches: b => b.slot === 'saturday' },
  {
    key: 'sundayEarly',
    label: 'Sunday early',
    matches: b => b.slot === 'sundayEarly',
  },
  {
    key: 'sundayLate',
    label: 'Sunday late',
    matches: b => b.slot === 'sundayLate',
  },
  {
    key: 'sundayNight',
    label: 'Sunday night',
    matches: b => b.slot === 'sundayNight',
  },
  { key: 'monday', label: 'Monday', matches: b => b.slot === 'monday' },
  { key: 'tuesday', label: 'Tuesday', matches: b => b.slot === 'tuesday' },
];

function splitStats(bets: SplitInput[]): SplitStats {
  const record = emptyRecord();
  for (const bet of bets) tally(record, bet.result);
  return {
    ...record,
    bets: bets.length,
    net: sum(bets.map(bet => bet.net)),
    wagered: sum(bets.map(bet => bet.amount)),
    winRate: winRate(record),
  };
}

/**
 * Only the buckets the member bet in. The rest - a Wednesday opener they sat
 * out, pick'em games, which are rare - would be a row of zeros that says
 * nothing about them, even when the field bet there.
 */
function split(
  definitions: SplitDefinition[],
  member: SplitInput[],
  field: SplitInput[],
): SplitBucket[] {
  return definitions
    .map(({ key, label, matches }) => ({
      key,
      label,
      member: splitStats(member.filter(matches)),
      field: splitStats(field.filter(matches)),
    }))
    .filter(bucket => bucket.member.bets > 0);
}

/**
 * How the member bets, next to how everyone else in the same seasons bet. The
 * field is everyone else's bets, so the member is not measured against
 * themselves.
 */
export function buildPoolSplits(
  mine: PoolBet[],
  rows: PoolBetRow[],
  userId: string,
): PoolSplits {
  const others: SplitInput[] = rows
    .filter(row => row.userId !== userId)
    .map(row => ({ ...row, slot: gameSlot(row.kickoff) }));

  return {
    side: split(SIDE_BUCKETS, mine, others),
    line: split(LINE_BUCKETS, mine, others),
    size: split(SIZE_BUCKETS, mine, others),
    venue: split(VENUE_BUCKETS, mine, others),
    // The field's share is measured per bet of the member's, so there is no
    // field column to set against it.
    crowd: split(CROWD_BUCKETS, mine, []),
    slot: split(SLOT_BUCKETS, mine, others),
  };
}
