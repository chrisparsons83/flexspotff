import type { GuillotineLeagueInput } from './guillotineProfile';
import {
  buildGuillotineCareer,
  buildGuillotineSeason,
  topClaims,
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
  processedAt: new Date(),
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
    });
    expect(season.picks.map(p => p.pickNo)).toEqual([1, 4]);
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
      // The champion lasted every scored week (2), the week-1 chop none.
      averageWeeksSurvived: 1,
      weekOneChops: 1,
      averagePoints: 110,
      bestWeek: { points: 130, year: 2025 },
    });
    expect(career.bidWinRate).toBeCloseTo(
      career.claimsWon / (career.claimsWon + career.bidsLost),
    );
  });

  it('copes with a member who has no scores yet', () => {
    const career = buildGuillotineCareer([], []);

    expect(career).toMatchObject({
      seasons: 0,
      averageWeeksSurvived: null,
      averagePoints: null,
      bestFinish: null,
      bidWinRate: null,
    });
  });
});

describe('topClaims', () => {
  it('ranks their winning bids across seasons', () => {
    const claims = topClaims([
      league(),
      league({ leagueId: 'league-b', year: 2025, rosterId: 2 }),
    ]);

    expect(claims.map(c => [c.year, c.sleeperId, c.bid])).toEqual([
      [2026, 'p1', 300],
      [2025, 'p2', 50],
    ]);
  });
});
