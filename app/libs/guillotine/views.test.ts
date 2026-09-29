import type { ViewTeam, ViewTransaction, ViewWeekScore } from './views';
import {
  buildChopGrid,
  buildFaabRemaining,
  buildStandings,
  buildWaiverRuns,
  cutLineForWeek,
} from './views';

// Three teams, two weeks played. Roster 3 is chopped in week 1, roster 2 in
// week 2, roster 1 is still alive.
const teams: ViewTeam[] = [
  { rosterId: 1, choppedWeek: null, finish: null },
  { rosterId: 2, choppedWeek: 2, finish: 2 },
  { rosterId: 3, choppedWeek: 1, finish: 3 },
];

const score = (
  rosterId: number,
  week: number,
  points: number,
  players: string[] = [],
): ViewWeekScore => ({ rosterId, week, points, players });

const scores: ViewWeekScore[] = [
  score(1, 1, 100),
  score(2, 1, 85),
  score(3, 1, 80, ['p1', 'p2']),
  score(1, 2, 90),
  score(2, 2, 70, ['p3']),
];

const transaction = (
  overrides: Partial<ViewTransaction> & Pick<ViewTransaction, 'adds'>,
): ViewTransaction => ({
  sleeperTransactionId: Math.random().toString(),
  type: 'waiver',
  status: 'complete',
  leg: 1,
  rosterIds: [],
  drops: null,
  bid: 0,
  notes: null,
  processedAt: new Date(),
  ...overrides,
});

describe('cutLineForWeek', () => {
  it("is the week's lowest score", () => {
    expect(cutLineForWeek(scores, 1)).toBe(80);
  });

  it('does not exist for a week nobody has scored in yet', () => {
    expect(cutLineForWeek([score(1, 3, 0), score(2, 3, 0)], 3)).toBeNull();
  });
});

describe('buildStandings', () => {
  it('puts survivors first, then the chopped in finishing order', () => {
    const rows = buildStandings({ teams, scores, lastScoredWeek: 2 });

    expect(rows.map(r => r.rosterId)).toEqual([1, 2, 3]);
    expect(rows[0]).toMatchObject({
      alive: true,
      weeksSurvived: 2,
      totalPoints: 190,
      averagePoints: 95,
      bestWeek: { week: 1, points: 100 },
    });
    expect(rows[2]).toMatchObject({ alive: false, weeksSurvived: 0 });
  });

  it('finds the closest escape, not counting the week a team was chopped', () => {
    const rows = buildStandings({ teams, scores, lastScoredWeek: 2 });

    expect(rows.find(r => r.rosterId === 2)?.closestEscape).toEqual({
      week: 1,
      margin: 5,
    });
    expect(rows.find(r => r.rosterId === 3)?.closestEscape).toBeNull();
  });

  it('leaves the week in progress out of the numbers', () => {
    const rows = buildStandings({
      teams,
      scores: [...scores, score(1, 3, 12)],
      lastScoredWeek: 2,
    });

    expect(rows[0].totalPoints).toBe(190);
  });
});

describe('buildChopGrid', () => {
  it('ranks each week and marks the chop', () => {
    const grid = buildChopGrid({ teams, scores, throughWeek: 2 });

    expect(grid.get(3)?.get(1)).toEqual({
      points: 80,
      rank: 3,
      margin: 0,
      chopped: true,
    });
    expect(grid.get(2)?.get(1)).toMatchObject({ margin: 5, chopped: false });
    // Gone by week 2.
    expect(grid.get(3)?.has(2)).toBe(false);
  });
});

describe('buildWaiverRuns', () => {
  it('gathers the bids on each player and where the player came from', () => {
    const runs = buildWaiverRuns({
      teams,
      scores,
      transactions: [
        transaction({ adds: { p1: 1 }, bid: 300 }),
        transaction({
          adds: { p1: 2 },
          bid: 250,
          status: 'failed',
          notes: 'This player was claimed by another owner.',
        }),
        transaction({ adds: { p1: 2 }, bid: 100, status: 'failed' }),
        transaction({ adds: { fa: 2 }, bid: 5 }),
        transaction({ adds: { x: 1 }, type: 'free_agent' }),
      ],
    });

    expect(runs).toHaveLength(1);
    expect(runs[0].week).toBe(2);
    const [top, second] = runs[0].claims;
    expect(top.sleeperId).toBe('p1');
    expect(top.winner).toMatchObject({ rosterId: 1, bid: 300 });
    expect(top.losingBids.map(b => b.bid)).toEqual([250, 100]);
    expect(top.releasedBy).toEqual({ rosterId: 3, week: 1 });
    expect(second).toMatchObject({ sleeperId: 'fa', releasedBy: null });
  });

  it('credits the latest release when a player was chopped twice', () => {
    // p9 went out with roster 3 in week 1, was claimed by roster 2, then went
    // out again with roster 2 in week 2.
    const twice = [
      ...scores.filter(
        s =>
          !(s.rosterId === 2 && s.week === 2) &&
          !(s.rosterId === 3 && s.week === 1),
      ),
      score(3, 1, 80, ['p1', 'p2', 'p9']),
      score(2, 2, 70, ['p3', 'p9']),
    ];
    const runs = buildWaiverRuns({
      teams,
      scores: twice,
      transactions: [
        transaction({ adds: { p9: 2 }, leg: 1 }),
        transaction({ adds: { p9: 1 }, leg: 2 }),
      ],
    });

    expect(runs.find(r => r.week === 2)?.claims[0].releasedBy).toEqual({
      rosterId: 3,
      week: 1,
    });
    expect(runs.find(r => r.week === 3)?.claims[0].releasedBy).toEqual({
      rosterId: 2,
      week: 2,
    });
  });

  it('ignores a release that came after the run', () => {
    const runs = buildWaiverRuns({
      teams,
      scores,
      transactions: [transaction({ adds: { p3: 1 }, leg: 1 })],
    });

    expect(runs[0].claims[0].releasedBy).toBeNull();
  });
});

describe('buildFaabRemaining', () => {
  it("tracks each team's budget left after every run", () => {
    const remaining = buildFaabRemaining({
      budget: 1000,
      runs: [
        {
          week: 3,
          claims: [
            {
              sleeperId: 'b',
              winner: { rosterId: 1, bid: 50, notes: null },
              losingBids: [],
              releasedBy: null,
            },
          ],
        },
        {
          week: 2,
          claims: [
            {
              sleeperId: 'a',
              winner: { rosterId: 1, bid: 300, notes: null },
              losingBids: [],
              releasedBy: null,
            },
          ],
        },
      ],
    });

    expect(remaining.get(1)?.get(2)).toBe(700);
    expect(remaining.get(1)?.get(3)).toBe(650);
  });
});
