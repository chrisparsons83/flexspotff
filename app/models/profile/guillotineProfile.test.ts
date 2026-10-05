import type { GuillotineLeagueInput } from './guillotineProfile';
import {
  buildGuillotineCareer,
  buildGuillotineSeason,
  winningClaims,
} from './guillotineProfile';
import type { ViewTransaction, ViewWeekScore } from '~/libs/guillotine/views';

const score = (
  rosterId: number,
  week: number,
  points: number,
  players: string[] = [],
): ViewWeekScore => ({ rosterId, week, points, players });

const waiver = (
  adds: Record<string, number>,
  bid: number,
  status: 'complete' | 'failed' = 'complete',
  leg = 1,
): ViewTransaction => ({
  sleeperTransactionId: `${Object.keys(adds)[0]}-${bid}-${status}`,
  type: 'waiver',
  status,
  leg,
  rosterIds: Object.values(adds),
  adds,
  drops: null,
  bid,
  notes: null,
  // A weekly run: Thursday just after midnight Pacific.
  processedAt: new Date('2025-09-11T07:01:00Z'),
});

// Three teams. Roster 3 goes in week 1, roster 2 in week 2; roster 1 (the
// member, in the first league) is still alive after two weeks.
const league = (
  overrides: Partial<GuillotineLeagueInput> = {},
): GuillotineLeagueInput => ({
  leagueId: 'league-a',
  leagueName: '🪓 Guillotine for the People',
  year: 2026,
  teamCount: 3,
  isComplete: false,
  lastScoredWeek: 2,
  rosterId: 1,
  faabLeft: 700,
  teams: [
    { rosterId: 1, choppedWeek: null, finish: null },
    { rosterId: 2, choppedWeek: 2, finish: 2 },
    { rosterId: 3, choppedWeek: 1, finish: 3 },
  ],
  scores: [
    score(1, 1, 90),
    score(2, 1, 88),
    score(3, 1, 70, ['p1']),
    score(1, 2, 110),
    score(2, 2, 60),
  ],
  transactions: [
    waiver({ p1: 1 }, 300),
    waiver({ p1: 2 }, 200, 'failed'),
    waiver({ p2: 2 }, 50),
    waiver({ p2: 1 }, 40, 'failed'),
  ],
  picks: [
    { pickNo: 4, round: 2, sleeperId: 'd2' },
    { pickNo: 1, round: 1, sleeperId: 'd1' },
  ],
  ...overrides,
});

describe('buildGuillotineSeason', () => {
  it("pulls the member's own row out of the league", () => {
    const season = buildGuillotineSeason(league());

    expect(season).toMatchObject({
      place: null,
      alive: true,
      choppedWeek: null,
      weeksSurvived: 2,
      averagePoints: 100,
      bestWeek: { week: 2, points: 110 },
      closestEscape: { week: 1, margin: 20 },
      claimsWon: 1,
      bidsLost: 1,
      faabSpent: 300,
      biggestClaim: { sleeperId: 'p1', bid: 300, week: 2 },
      weeksPlayed: 2,
      // Top of the field both weeks.
      weeklyPercentiles: [1, 1],
      topScoreWeeks: 2,
    });
    expect(season.picks.map(p => p.pickNo)).toEqual([1, 4]);
  });

  it('measures each week against the teams still in it', () => {
    // Roster 2: 2nd of 3 beats half the field, then last of 2 beats none.
    const season = buildGuillotineSeason(league({ rosterId: 2 }));

    expect(season).toMatchObject({
      weeklyPercentiles: [0.5, 0],
      topScoreWeeks: 0,
    });
  });

  it('marks each week of the survival strip', () => {
    const season = buildGuillotineSeason(league({ rosterId: 2 }));

    expect(season.weeks).toHaveLength(17);
    expect(season.weeks[0]).toMatchObject({ state: 'survived', margin: 18 });
    expect(season.weeks[1]).toMatchObject({ state: 'chopped', points: 60 });
    expect(season.weeks[2].state).toBe('gone');

    const alive = buildGuillotineSeason(league());
    expect(alive.weeks[2].state).toBe('pending');
  });
});

describe('buildGuillotineCareer', () => {
  it('adds seasons up, leaving a live season out of survival', () => {
    const live = buildGuillotineSeason(league());
    const won = buildGuillotineSeason(
      league({
        leagueId: 'league-b',
        year: 2025,
        isComplete: true,
        rosterId: 2,
        teams: [
          { rosterId: 1, choppedWeek: 2, finish: 2 },
          { rosterId: 2, choppedWeek: null, finish: 1 },
          { rosterId: 3, choppedWeek: 1, finish: 3 },
        ],
      }),
    );
    const firstOut = buildGuillotineSeason(
      league({ leagueId: 'league-c', year: 2024, rosterId: 3 }),
    );

    const career = buildGuillotineCareer(
      [live, won, firstOut],
      [
        { points: 90, week: 1, year: 2026, leagueName: 'a' },
        { points: 130, week: 3, year: 2025, leagueName: 'b' },
      ],
    );

    expect(career).toMatchObject({
      seasons: 3,
      titles: 1,
      podiums: 2,
      bestFinish: { place: 1, year: 2025 },
      // The live season counts towards the longest run, never the shortest.
      longestRun: { weeks: 2, year: 2026, alive: true },
      shortestRun: { weeks: 1, year: 2024 },
      averagePoints: 110,
      bestWeek: { points: 130, year: 2025 },
      // Weeks at 1, 1 (live), 0.5, 0 (won) and 0 (first out).
      averagePercentile: 0.5,
      biggestBid: { bid: 300, year: 2026 },
    });
    expect(career.bidWinRate).toBeCloseTo(
      career.claimsWon / (career.claimsWon + career.bidsLost),
    );
  });

  it('copes with a member who has no scores yet', () => {
    const career = buildGuillotineCareer([], []);

    expect(career).toMatchObject({
      seasons: 0,
      longestRun: null,
      shortestRun: null,
      averagePoints: null,
      averagePercentile: null,
      biggestBid: null,
      bestFinish: null,
      bidWinRate: null,
    });
  });
});

describe('winningClaims', () => {
  it('ranks their winning bids across seasons', () => {
    const claims = winningClaims([
      league(),
      league({ leagueId: 'league-b', year: 2025, rosterId: 2 }),
    ]);

    expect(claims.map(c => [c.year, c.sleeperId, c.bid])).toEqual([
      [2026, 'p1', 300],
      [2025, 'p2', 50],
    ]);
  });
});

describe('averageWinningBid', () => {
  it('averages the bids that won, not the ones that lost', () => {
    const season = buildGuillotineSeason(
      league({
        transactions: [
          waiver({ p1: 1 }, 30),
          waiver({ p2: 1 }, 10),
          waiver({ p2: 2 }, 50),
        ],
      }),
    );

    expect(buildGuillotineCareer([season], [])).toMatchObject({
      claimsWon: 1,
      averageWinningBid: 30,
    });
  });
});

describe('draft pick teams', () => {
  it('counts every roster a drafted player was on, the drafter included', () => {
    const season = buildGuillotineSeason(
      league({
        picks: [
          // Rostered by 3 in week 1, after roster 1 drafted and let him go.
          { pickNo: 1, round: 1, sleeperId: 'p1' },
          // Never on a scored roster: just the drafter.
          { pickNo: 2, round: 1, sleeperId: 'p9' },
        ],
        scores: [
          score(1, 1, 90),
          score(3, 1, 70, ['p1']),
          score(2, 2, 60, ['p1']),
        ],
      }),
    );

    expect(season.picks.map(pick => pick.teams)).toEqual([3, 1]);
  });
});
