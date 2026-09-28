import {
  buildFieldBanks,
  buildPoolBets,
  buildPoolCareer,
  buildPoolSeasons,
  buildPoolSplits,
  buildPoolTeams,
  buildPoolWeeks,
  buildSeasonTotals,
  gameSlot,
  type BetResult,
  type PoolBetRow,
  type PoolMissedRow,
} from './spreadPoolProfile';
import { describe, expect, it } from 'vitest';

const ATL = 'ATL';
const TEN = 'TEN';
const PHI = 'PHI';
const DAL = 'DAL';

// A Sunday, 1pm in New York.
const SUNDAY_1PM = new Date('2024-09-08T17:00:00Z');

let gameCounter = 0;

/**
 * A bet on `backed` against `opponent`, with the net worked out from the
 * result: even money, and a push returns the stake.
 */
const bet = (
  userId: string,
  {
    year = 2024,
    week = 1,
    gameId,
    backed = ATL,
    opponent = TEN,
    amount = 50,
    result = 'win',
    spread = -3,
    isHome = true,
    teamScore = 24,
    opponentScore = 17,
    kickoff = SUNDAY_1PM,
  }: Partial<Omit<PoolBetRow, 'userId' | 'team' | 'net'>> & {
    backed?: string;
    result?: BetResult;
  } = {},
): PoolBetRow => ({
  userId,
  year,
  week,
  gameId: gameId ?? `game-${++gameCounter}`,
  amount,
  net: result === 'win' ? amount : result === 'loss' ? -amount : 0,
  result,
  team: backed,
  opponent,
  isHome,
  spread,
  teamScore,
  opponentScore,
  kickoff,
});

const missedWeek = (
  userId: string,
  year: number,
  week: number,
): PoolMissedRow => ({ userId, year, week, net: -20 });

/** The pipeline the loader runs, for tests that need seasons. */
function profile(
  rows: PoolBetRow[],
  missed: PoolMissedRow[] = [],
  inProgressYear: number | null = null,
) {
  const bets = buildPoolBets(rows, 'me');
  const weeks = buildPoolWeeks({ bets, rows, missed, userId: 'me' });
  const seasons = buildPoolSeasons({
    weeks,
    totals: buildSeasonTotals(rows, missed),
    fieldBanks: new Map(),
    userId: 'me',
    inProgressYear,
  });
  return { bets, weeks, seasons, career: buildPoolCareer(seasons) };
}

describe('buildPoolBets', () => {
  it('measures the cover against the line on the team bet', () => {
    const [giving, taking] = buildPoolBets(
      [
        bet('me', { spread: -3, teamScore: 24, opponentScore: 17, week: 1 }),
        bet('me', { spread: 6.5, teamScore: 10, opponentScore: 14, week: 2 }),
      ],
      'me',
    );

    expect(giving.coverMargin).toBe(4);
    expect(taking.coverMargin).toBe(2.5);
  });

  it('counts the share of the rest of the field on the same side', () => {
    const rows = [
      bet('me', { gameId: 'g', backed: ATL, opponent: TEN }),
      bet('a', { gameId: 'g', backed: ATL, opponent: TEN }),
      bet('b', { gameId: 'g', backed: TEN, opponent: ATL }),
      bet('c', { gameId: 'g', backed: TEN, opponent: ATL }),
      bet('d', { gameId: 'g', backed: TEN, opponent: ATL }),
      bet('me', { gameId: 'lonely' }),
    ];
    const [crowded, lonely] = buildPoolBets(rows, 'me');

    expect(crowded.fieldShare).toBe(0.25);
    expect(lonely.fieldShare).toBeNull();
  });
});

describe('gameSlot', () => {
  it('reads the window off the New York clock', () => {
    expect(gameSlot(new Date('2024-09-06T00:20:00Z'))).toBe('thursday');
    expect(gameSlot(SUNDAY_1PM)).toBe('sundayEarly');
    // London, 9:30am in New York.
    expect(gameSlot(new Date('2024-10-13T13:30:00Z'))).toBe('sundayEarly');
    expect(gameSlot(new Date('2024-09-08T20:25:00Z'))).toBe('sundayLate');
    expect(gameSlot(new Date('2024-09-09T00:20:00Z'))).toBe('sundayNight');
    // 8:15pm Monday in New York is already Tuesday in UTC.
    expect(gameSlot(new Date('2024-09-10T00:15:00Z'))).toBe('monday');
    // The December Saturdays, Black Friday and Christmas get their own days.
    expect(gameSlot(new Date('2024-12-21T21:30:00Z'))).toBe('saturday');
    expect(gameSlot(new Date('2024-11-29T20:00:00Z'))).toBe('friday');
    expect(gameSlot(new Date('2024-12-25T18:00:00Z'))).toBe('wednesday');
  });
});

describe('buildSeasonTotals', () => {
  it('adds missed-week penalties to what each member won and lost', () => {
    const totals = buildSeasonTotals(
      [
        bet('me', { result: 'win', amount: 40 }),
        bet('me', { result: 'loss', amount: 10 }),
        bet('a', { result: 'loss', amount: 50 }),
      ],
      [missedWeek('me', 2024, 2)],
    );

    expect(totals.get(2024)?.get('me')).toBe(10);
    expect(totals.get(2024)?.get('a')).toBe(-50);
  });

  it('leaves out anyone whose only row that season is a penalty', () => {
    const totals = buildSeasonTotals(
      [bet('me', { year: 2024 })],
      [missedWeek('ghost', 2024, 1), missedWeek('me', 2025, 1)],
    );

    expect(totals.get(2024)?.has('ghost')).toBe(false);
    expect(totals.has(2025)).toBe(false);
  });
});

describe('buildPoolWeeks', () => {
  it('runs the bank through each season and restarts it the next', () => {
    const { weeks } = profile(
      [
        bet('me', { year: 2023, week: 1, result: 'win', amount: 30 }),
        bet('me', { year: 2023, week: 2, result: 'loss', amount: 50 }),
        bet('me', { year: 2024, week: 1, result: 'win', amount: 10 }),
      ],
      [missedWeek('me', 2023, 3)],
    );

    expect(weeks.map(week => [week.year, week.week, week.bank])).toEqual([
      [2023, 1, 1030],
      [2023, 2, 980],
      [2023, 3, 960],
      [2024, 1, 1010],
    ]);
    expect(weeks[2].missed).toBe(true);
    expect(weeks[2].bets).toEqual([]);
  });

  it('ranks the week against everyone with a result in it, penalties included', () => {
    const { weeks } = profile(
      [
        bet('me', { result: 'loss', amount: 10 }),
        bet('a', { result: 'win', amount: 50 }),
        bet('b', { result: 'loss', amount: 50 }),
        // c bet later in the season, so their week-1 penalty counts.
        bet('c', { week: 2 }),
      ],
      [missedWeek('c', 2024, 1)],
    );

    expect(weeks[0].rank).toBe(2);
    expect(weeks[0].fieldSize).toBe(4);
  });

  it('leaves out penalties for anyone who never bet that season', () => {
    // Saving an entry charges earlier weeks, so a penalty can outlive a bet.
    const { weeks } = profile(
      [bet('me', { result: 'loss', amount: 10 }), bet('a', { result: 'win' })],
      [missedWeek('ghost', 2024, 1)],
    );

    expect(weeks[0].fieldSize).toBe(2);
    expect(weeks[0].rank).toBe(2);
  });

  it('adds up the week and lists its biggest bets first', () => {
    const { weeks } = profile([
      bet('me', { result: 'win', amount: 20 }),
      bet('me', { result: 'push', amount: 50 }),
      bet('me', { result: 'loss', amount: 30 }),
    ]);

    expect(weeks[0].net).toBe(-10);
    expect(weeks[0].wagered).toBe(100);
    expect(weeks[0].record).toEqual({ wins: 1, losses: 1, pushes: 1 });
    expect(weeks[0].bets.map(b => b.amount)).toEqual([50, 30, 20]);
  });
});

describe('buildPoolSeasons', () => {
  it('ranks the finish by the net the standings use', () => {
    const { seasons } = profile(
      [
        bet('me', { result: 'win', amount: 30 }),
        bet('a', { result: 'win', amount: 50 }),
        bet('b', { result: 'win', amount: 40 }),
      ],
      // b's missed week drops them below the member.
      [missedWeek('b', 2024, 2)],
    );

    expect(seasons[0].finish).toEqual({ rank: 2, fieldSize: 3 });
    expect(seasons[0].roe).toBeCloseTo(1);
  });

  it('crowns a finished season only, and never a losing one', () => {
    const winning = profile([
      bet('me', { result: 'win' }),
      bet('a', { result: 'loss' }),
    ]);
    const running = profile(
      [bet('me', { result: 'win' }), bet('a', { result: 'loss' })],
      [],
      2024,
    );
    const losing = profile([
      bet('me', { result: 'loss', amount: 10 }),
      bet('a', { result: 'loss', amount: 50 }),
    ]);

    expect(winning.seasons[0].champion).toBe(true);
    expect(running.seasons[0].champion).toBe(false);
    expect(losing.seasons[0].finish?.rank).toBe(1);
    expect(losing.seasons[0].champion).toBe(false);
  });
});

describe('buildPoolCareer', () => {
  it('counts wins, losses and pushes, not every game on the slate', () => {
    // What the loader passes is bets only: a zero-bet row would have been one
    // of these for every side of every game the member skipped.
    const { career } = profile([
      bet('me', { result: 'win' }),
      bet('me', { result: 'win' }),
      bet('me', { result: 'loss' }),
      bet('me', { result: 'push' }),
    ]);

    expect(career.record).toEqual({ wins: 2, losses: 1, pushes: 1 });
    expect(career.winRate).toBeCloseTo(2 / 3);
    expect(career.bets).toBe(4);
    expect(career.maxBets).toBe(4);
  });

  it('keeps missed weeks out of the best and worst week', () => {
    const { career } = profile(
      [
        bet('me', { week: 1, result: 'win', amount: 10 }),
        bet('me', { week: 2, result: 'win', amount: 20 }),
      ],
      [missedWeek('me', 2024, 3)],
    );

    expect(career.worstWeek?.week).toBe(1);
    expect(career.weeks).toEqual({ wins: 2, losses: 0, pushes: 0 });
    expect(career.missedWeeks).toBe(1);
    expect(career.missedCost).toBe(-20);
    expect(career.weeksPlayed).toBe(2);
  });

  it('counts topping a losing season as a 2nd, the way the badge does', () => {
    const { career } = profile([
      bet('me', { result: 'loss', amount: 10 }),
      bet('a', { result: 'loss', amount: 50 }),
    ]);

    expect(career.titles).toBe(0);
    expect(career.bestFinish).toMatchObject({ rank: 2, year: 2024 });
    expect(career.averageFinish).toBe(2);
  });

  it('leaves the running season out of finishes and final banks', () => {
    const { career } = profile(
      [
        bet('me', { year: 2023, result: 'win', amount: 50 }),
        bet('me', { year: 2024, result: 'win', amount: 10 }),
        bet('a', { year: 2024, result: 'win', amount: 50 }),
      ],
      [],
      2024,
    );

    expect(career.completedSeasons).toBe(1);
    expect(career.bestBank).toEqual({ bank: 1050, year: 2023 });
    expect(career.standing).toEqual({ rank: 2, fieldSize: 2, year: 2024 });
    expect(career.net).toBe(60);
  });
});

describe('buildPoolTeams', () => {
  it('keeps backing and fading a team apart', () => {
    const bets = buildPoolBets(
      [
        bet('me', { backed: TEN, opponent: ATL, result: 'loss', week: 1 }),
        bet('me', { backed: DAL, opponent: TEN, result: 'win', week: 2 }),
      ],
      'me',
    );
    const titans = buildPoolTeams(bets).find(row => row.team === TEN)!;

    expect(titans.backing).toMatchObject({ bets: 1, losses: 1, net: -50 });
    expect(titans.fading).toMatchObject({ bets: 1, wins: 1, net: 50 });
    expect(titans.net).toBe(0);
  });

  it('puts the most won first', () => {
    const bets = buildPoolBets(
      [
        bet('me', { backed: ATL, opponent: TEN, result: 'win', amount: 10 }),
        bet('me', { backed: PHI, opponent: DAL, result: 'loss', amount: 40 }),
      ],
      'me',
    );
    const order = buildPoolTeams(bets).map(row => row.team);

    // Level teams fall back to alphabetical.
    expect(order).toEqual(['ATL', 'TEN', 'DAL', 'PHI']);
  });
});

describe('buildPoolSplits', () => {
  const rows = [
    bet('me', { spread: -3, result: 'win', isHome: true }),
    bet('me', { spread: 7, result: 'loss', isHome: false, amount: 20 }),
    bet('me', { spread: 10, result: 'win', isHome: false, amount: 30 }),
    bet('a', { spread: -3, result: 'loss' }),
    bet('a', { spread: -9, result: 'loss' }),
  ];
  const splits = buildPoolSplits(buildPoolBets(rows, 'me'), rows, 'me');

  it('sets the member’s favorites and underdogs against the field’s', () => {
    const [favorite, underdog] = splits.side;

    expect(favorite.key).toBe('favorite');
    expect(favorite.member).toMatchObject({ bets: 1, wins: 1 });
    expect(favorite.field).toMatchObject({ bets: 2, losses: 2, net: -100 });
    expect(underdog.member).toMatchObject({ bets: 2, wins: 1, losses: 1 });
    expect(underdog.member.winRate).toBeCloseTo(0.5);
  });

  it('drops buckets the member did not bet, even when the field did', () => {
    expect(splits.side.map(bucket => bucket.key)).not.toContain('pick');
    // Only the field took a big favorite.
    expect(splits.line.map(bucket => bucket.key)).toEqual([
      'smallFav',
      'dog',
      'bigDog',
    ]);
  });

  it('gives each bet size a row of its own', () => {
    expect(
      splits.size.map(bucket => [bucket.label, bucket.member.bets]),
    ).toEqual([
      ['20', 1],
      ['30', 1],
      ['50 (max)', 1],
    ]);
  });
});

describe('buildFieldBanks', () => {
  it('tracks the spread of banks, carrying anyone idle that week', () => {
    const points = buildFieldBanks(
      [
        { userId: 'a', week: 1, net: 50 },
        { userId: 'b', week: 1, net: -50 },
        { userId: 'c', week: 2, net: 30 },
      ],
      [{ userId: 'a', week: 2, net: -20 }],
    );

    expect(points).toEqual([
      { week: 1, low: 950, high: 1050, q1: 975, median: 1000, q3: 1025 },
      { week: 2, low: 950, high: 1030, q1: 990, median: 1030, q3: 1030 },
    ]);
  });
});
