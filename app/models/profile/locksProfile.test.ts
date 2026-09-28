import {
  buildFieldRace,
  buildLocksCareer,
  buildLocksPicks,
  buildLocksSeasons,
  buildLocksSplits,
  buildLocksTeams,
  buildLocksWeeks,
  buildRiskProfile,
  buildSeasonTotals,
  type LocksPickRow,
  type PickResult,
} from './locksProfile';
import { describe, expect, it } from 'vitest';

// A Sunday, 1pm in New York.
const SUNDAY_1PM = new Date('2024-09-08T17:00:00Z');

let gameCounter = 0;

/** A pick of `team` over `opponent`, with a final score to match the result. */
const pick = (
  userId: string,
  {
    year = 2024,
    week = 1,
    gameId,
    team = 'ATL',
    opponent = 'TEN',
    result = 'win',
    spread = -3,
    isHome = true,
    kickoff = SUNDAY_1PM,
  }: Partial<Omit<LocksPickRow, 'userId'>> & { result?: PickResult } = {},
): LocksPickRow => ({
  userId,
  year,
  week,
  gameId: gameId ?? `game-${++gameCounter}`,
  result,
  team,
  opponent,
  isHome,
  spread,
  teamScore: result === 'loss' ? 17 : 24,
  opponentScore: result === 'win' ? 17 : 24,
  kickoff,
});

/** `wins` wins and `losses` losses for one member in one week. */
const week = (
  userId: string,
  { wins = 0, losses = 0, ties = 0, year = 2024, week: number = 1 },
) => [
  ...Array.from({ length: wins }, () =>
    pick(userId, { year, week: number, result: 'win' }),
  ),
  ...Array.from({ length: losses }, () =>
    pick(userId, { year, week: number, result: 'loss' }),
  ),
  ...Array.from({ length: ties }, () =>
    pick(userId, { year, week: number, result: 'tie' }),
  ),
];

/** The pipeline the loader runs, for tests that need seasons. */
function profile(rows: LocksPickRow[], inProgressYear: number | null = null) {
  const picks = buildLocksPicks(rows, 'me');
  const weeks = buildLocksWeeks({ picks, rows, userId: 'me' });
  const years = [...new Set(rows.map(row => row.year))];
  const seasons = buildLocksSeasons({
    weeks,
    totals: buildSeasonTotals(rows),
    fieldRaces: new Map(
      years.map(year => [
        year,
        buildFieldRace(rows.filter(row => row.year === year)),
      ]),
    ),
    userId: 'me',
    inProgressYear,
  });
  return { picks, weeks, seasons };
}

describe('buildSeasonTotals', () => {
  it('scores a week its wins, unless anything in it lost', () => {
    const totals = buildSeasonTotals([
      ...week('me', { wins: 3, week: 1 }),
      ...week('me', { wins: 5, losses: 1, week: 2 }),
      ...week('me', { wins: 2, ties: 1, week: 3 }),
    ]);
    expect(totals.get(2024)!.get('me')).toBe(5);
  });

  it('keeps a member who busted every week, on zero', () => {
    const totals = buildSeasonTotals(week('them', { wins: 2, losses: 1 }));
    expect(totals.get(2024)!.get('them')).toBe(0);
  });
});

describe('buildLocksPicks', () => {
  it('measures the field on a game against everyone else who picked it', () => {
    const rows = [
      pick('me', { gameId: 'g', team: 'ATL', opponent: 'TEN' }),
      pick('a', { gameId: 'g', team: 'ATL', opponent: 'TEN' }),
      pick('b', { gameId: 'g', team: 'ATL', opponent: 'TEN' }),
      pick('c', { gameId: 'g', team: 'TEN', opponent: 'ATL' }),
      pick('d', { gameId: 'other' }),
    ];
    const [mine] = buildLocksPicks(rows, 'me');
    expect(mine).toMatchObject({ fieldCount: 3, sameSide: 2 });
    expect(mine.fieldShare).toBeCloseTo(2 / 3);
  });

  it('has no share for a game nobody else picked', () => {
    const [mine] = buildLocksPicks([pick('me', { gameId: 'g' })], 'me');
    expect(mine).toMatchObject({ fieldCount: 0, fieldShare: null });
  });
});

describe('buildLocksWeeks', () => {
  it('keeps the wins a loss wiped out, and runs the season total', () => {
    const { weeks } = profile([
      ...week('me', { wins: 3, week: 1 }),
      ...week('me', { wins: 4, losses: 1, week: 2 }),
      ...week('me', { wins: 2, week: 3 }),
    ]);
    expect(
      weeks.map(({ points, clean, forfeited, total }) => ({
        points,
        clean,
        forfeited,
        total,
      })),
    ).toEqual([
      { points: 3, clean: true, forfeited: 0, total: 3 },
      { points: 0, clean: false, forfeited: 4, total: 3 },
      { points: 2, clean: true, forfeited: 0, total: 5 },
    ]);
  });

  it('ranks a week against everyone who entered it, sharing ties', () => {
    const { weeks } = profile([
      ...week('me', { wins: 2 }),
      ...week('a', { wins: 2 }),
      ...week('b', { wins: 5 }),
      ...week('c', { wins: 9, losses: 1 }),
    ]);
    expect(weeks[0]).toMatchObject({ rank: 2, fieldSize: 4 });
  });

  it('restarts the running total each season', () => {
    const { weeks } = profile([
      ...week('me', { wins: 3, year: 2024 }),
      ...week('me', { wins: 1, year: 2025 }),
    ]);
    expect(weeks.map(entry => entry.total)).toEqual([3, 1]);
  });
});

describe('buildLocksSeasons', () => {
  it('shares a title on equal points, with no tiebreak on wins', () => {
    const { seasons } = profile([
      ...week('me', { wins: 4, week: 1 }),
      ...week('rival', { wins: 2, week: 1 }),
      ...week('rival', { wins: 9, losses: 1, week: 2 }),
      ...week('rival', { wins: 2, week: 3 }),
    ]);
    expect(seasons[0]).toMatchObject({
      points: 4,
      champion: true,
      finish: { rank: 1, fieldSize: 2, tied: true },
    });
  });

  it('awards nothing for a season still being played', () => {
    const { seasons } = profile(week('me', { wins: 4, year: 2026 }), 2026);
    expect(seasons[0]).toMatchObject({ inProgress: true, champion: false });
  });

  it('awards nothing for topping a season everyone busted', () => {
    const { seasons } = profile([
      ...week('me', { wins: 3, losses: 1 }),
      ...week('a', { wins: 1, losses: 1 }),
    ]);
    expect(seasons[0]).toMatchObject({
      champion: false,
      finish: { rank: 1, tied: true },
    });
  });

  it('newest season first', () => {
    const { seasons } = profile([
      ...week('me', { wins: 1, year: 2024 }),
      ...week('me', { wins: 1, year: 2025 }),
    ]);
    expect(seasons.map(season => season.year)).toEqual([2025, 2024]);
  });
});

describe('buildFieldRace', () => {
  it('carries a total through a week its owner sat out', () => {
    const race = buildFieldRace([
      ...week('a', { wins: 4, week: 1 }),
      ...week('b', { wins: 1, week: 1 }),
      ...week('b', { wins: 2, week: 2 }),
    ]);
    expect(race).toEqual([
      { week: 1, low: 1, high: 4, q1: 1.75, q3: 3.25, median: 2.5 },
      { week: 2, low: 3, high: 4, q1: 3.25, q3: 3.75, median: 3.5 },
    ]);
  });

  it('counts everyone who entered the season from week one', () => {
    const race = buildFieldRace([
      ...week('a', { wins: 4, week: 1 }),
      ...week('late', { wins: 1, week: 2 }),
    ]);
    expect(race[0]).toMatchObject({ low: 0, high: 4 });
  });
});

describe('buildLocksCareer', () => {
  it('runs the scoring streak across seasons, over weeks entered only', () => {
    const rows = [
      ...week('me', { wins: 1, year: 2024, week: 16 }),
      ...week('me', { wins: 1, year: 2024, week: 17 }),
      ...week('me', { wins: 1, year: 2025, week: 3 }),
      ...week('me', { losses: 1, year: 2025, week: 4 }),
      ...week('me', { wins: 1, year: 2025, week: 5 }),
    ];
    const { seasons } = profile(rows);
    expect(buildLocksCareer(seasons).longestCleanStreak).toBe(3);
  });

  it('finds the biggest and smallest wins, earliest first on a tie', () => {
    const rows = [
      ...week('me', { wins: 2, week: 1 }),
      ...week('me', { wins: 8, week: 2 }),
      ...week('me', { wins: 2, week: 3 }),
      ...week('me', { ties: 1, week: 4 }),
    ];
    const { seasons } = profile(rows);
    const career = buildLocksCareer(seasons);
    expect(career.bestWeek).toMatchObject({ week: 2, points: 8 });
    // A week of nothing but ties scored nothing, so it is not a win.
    expect(career.smallestWin).toMatchObject({ week: 1, points: 2 });
  });

  it('tells the biggest bust from the nearest miss', () => {
    const rows = [
      ...week('me', { wins: 5, losses: 1, week: 1 }),
      ...week('me', { wins: 7, losses: 2, week: 2 }),
      ...week('me', { wins: 1, losses: 4, week: 3 }),
      ...week('me', { wins: 8, week: 4 }),
    ];
    const { seasons } = profile(rows);
    const career = buildLocksCareer(seasons);
    expect(career.worstBust).toMatchObject({ week: 2, forfeited: 7 });
    expect(career.nearMiss).toMatchObject({ week: 1, forfeited: 5 });
    expect(career.bustsByLosses).toEqual({ one: 1, two: 1, more: 1 });
    expect(career.forfeited).toBe(13);
    expect(career.weeksWon).toBe(1);
  });
});

describe('buildRiskProfile', () => {
  it('buckets weeks by picks made, member against the field', () => {
    const rows = [
      ...week('me', { wins: 2, week: 1 }),
      ...week('me', { wins: 1, losses: 1, week: 2 }),
      ...week('me', { wins: 6, week: 3 }),
      ...week('a', { wins: 2, week: 1 }),
      ...week('a', { wins: 2, week: 2 }),
    ];
    const { weeks } = profile(rows);
    const risk = buildRiskProfile(weeks, rows, 'me');
    expect(risk.map(bucket => bucket.label)).toEqual(['2 picks', '6 picks']);
    expect(risk[0].member).toMatchObject({
      weeks: 2,
      cleanRate: 0.5,
      pointsPerWeek: 1,
    });
    expect(risk[0].field).toMatchObject({
      weeks: 2,
      cleanRate: 1,
      pointsPerWeek: 2,
    });
  });
});

describe('buildLocksSplits', () => {
  it('sorts picks by the Spread Pool line, and keeps games without one apart', () => {
    const rows = [
      pick('me', { spread: -7.5 }),
      pick('me', { spread: 3, result: 'loss' }),
      pick('me', { spread: null }),
    ];
    const { picks } = profile(rows);
    const splits = buildLocksSplits(picks, rows, 'me');
    expect(
      splits.side.map(bucket => [bucket.key, bucket.member.picks]),
    ).toEqual([
      ['favorite', 1],
      ['underdog', 1],
      ['none', 1],
    ]);
    expect(splits.line.map(bucket => bucket.key)).toEqual([
      'bigFav',
      'smallDog',
    ]);
  });

  it('keeps a side only the field picked, so its share covers every pick', () => {
    const rows = [
      pick('me', { spread: -3 }),
      pick('a', { spread: -3 }),
      pick('b', { spread: 4 }),
    ];
    const { picks } = profile(rows);
    const side = buildLocksSplits(picks, rows, 'me').side;
    expect(
      side.map(bucket => [bucket.key, bucket.member.picks, bucket.field.picks]),
    ).toEqual([
      ['favorite', 1, 1],
      ['underdog', 0, 1],
    ]);
  });

  it('calls a pick chalk or contrarian by the others on the game', () => {
    const rows = [
      pick('me', { gameId: 'chalk', team: 'ATL', opponent: 'TEN' }),
      ...['a', 'b', 'c'].map(user =>
        pick(user, { gameId: 'chalk', team: 'ATL', opponent: 'TEN' }),
      ),
      pick('me', {
        gameId: 'lonely',
        team: 'NYJ',
        opponent: 'BUF',
        result: 'loss',
      }),
      ...['a', 'b', 'c', 'd'].map(user =>
        pick(user, { gameId: 'lonely', team: 'BUF', opponent: 'NYJ' }),
      ),
    ];
    const { picks } = profile(rows);
    const crowd = buildLocksSplits(picks, rows, 'me').crowd;
    expect(crowd.map(bucket => [bucket.key, bucket.member.wins])).toEqual([
      ['chalk', 1],
      ['contrarian', 0],
    ]);
    // The others' picks on the lonely game were all chalk, and all won.
    expect(crowd[0].field).toMatchObject({ picks: 7, wins: 7 });
  });
});

describe('buildLocksTeams', () => {
  it('pins a bust on every loser, and its points only on a sole loser', () => {
    const rows = [
      pick('me', { week: 1, team: 'ATL', opponent: 'TEN' }),
      pick('me', { week: 1, team: 'DAL', opponent: 'PHI' }),
      pick('me', { week: 1, team: 'NYJ', opponent: 'BUF', result: 'loss' }),
      pick('me', { week: 2, team: 'ATL', opponent: 'NO' }),
      pick('me', { week: 2, team: 'NYJ', opponent: 'MIA', result: 'loss' }),
      pick('me', { week: 2, team: 'DAL', opponent: 'NYG', result: 'loss' }),
    ];
    const { weeks } = profile(rows);
    const teams = new Map(buildLocksTeams(weeks).map(row => [row.team, row]));
    expect(teams.get('NYJ')).toMatchObject({ busts: 2, pointsCost: 2 });
    expect(teams.get('DAL')).toMatchObject({ busts: 1, pointsCost: 0 });
    expect(teams.get('ATL')!.backing).toMatchObject({ picks: 2, wins: 2 });
    expect(teams.get('BUF')!.fading).toMatchObject({ picks: 1, losses: 1 });
  });
});
