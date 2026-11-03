import type { WeekFacts, WeekLineup } from './lineups';
import {
  buildRoundLineups,
  buildWeekLineup,
  chooseLineup,
  roundTotal,
} from './lineups';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-01T20:00:00Z');

const facts = (
  overrides: Partial<WeekFacts> = {},
  state: 'pre_game' | 'in_game' | 'complete' = 'pre_game',
): WeekFacts => ({
  playerBySleeperId: new Map([
    ['1', { id: 'a', fullName: 'Ann', position: 'QB', nflTeam: 'KC' }],
    ['2', { id: 'b', fullName: 'Bo', position: 'RB', nflTeam: 'KC' }],
    ['3', { id: 'c', fullName: 'Cy', position: 'WR', nflTeam: 'SEA' }],
  ]),
  projectionByPlayerId: new Map([
    ['a', 20],
    ['b', 10],
    ['c', 8],
  ]),
  gameByNflTeam: new Map([
    // Half of a 185 minute game gone by NOW.
    [
      'KC',
      {
        state,
        kickoff: new Date(NOW.getTime() - (185 / 2) * 60_000),
      },
    ],
  ]),
  ...overrides,
});

const teamGame = (points: number[] = [0, 0], starters = ['1', '2']) => ({
  week: 9,
  pointsScored: points.reduce((sum, p) => sum + p, 0),
  starters,
  startingPlayerPoints: points,
});

describe('buildWeekLineup', () => {
  it('projects the whole week before kickoff', () => {
    const lineup = buildWeekLineup(teamGame(), facts(), NOW);

    expect(lineup.projected).toBe(30);
    expect(lineup.finished).toBe(false);
  });

  it('adds what is left of the projection to the points while games are on', () => {
    const lineup = buildWeekLineup(
      teamGame([12, 3]),
      facts({}, 'in_game'),
      NOW,
    );

    // 15 scored, plus half of the 30 still to come.
    expect(lineup.projected).toBe(30);
    expect(lineup.points).toBe(15);
    expect(lineup.starters[0]).toMatchObject({
      name: 'Ann',
      points: 12,
      projected: 22,
      state: 'in_game',
    });
  });

  it('lands on the score once the week is over', () => {
    const lineup = buildWeekLineup(
      teamGame([25, 2]),
      facts({}, 'complete'),
      NOW,
    );

    expect(lineup.finished).toBe(true);
    expect(lineup.points).toBe(27);
    expect(lineup.projected).toBe(27);
    expect(lineup.starters[0]!.projected).toBe(25);
  });

  it('counts a starter on bye as done, with nothing to come', () => {
    const lineup = buildWeekLineup(
      teamGame([0, 0], ['1', '3']),
      facts({ projectionByPlayerId: new Map([['a', 20]]) }),
      NOW,
    );

    expect(lineup.projected).toBe(20);
    expect(lineup.starters[1]).toMatchObject({ name: 'Cy', state: 'bye' });
  });

  it('leaves out empty slots', () => {
    const lineup = buildWeekLineup(teamGame([0, 0], ['1', '0']), facts(), NOW);

    expect(lineup.starters.map(s => s.name)).toEqual(['Ann']);
    expect(lineup.projected).toBe(20);
  });

  it('does not call a team with no lineup finished', () => {
    const lineup = buildWeekLineup(
      teamGame([0, 0], ['0', '0']),
      facts({}, 'complete'),
      NOW,
    );

    expect(lineup.finished).toBe(false);
  });

  it('has no projection for a week with none stored', () => {
    const lineup = buildWeekLineup(
      teamGame([25, 2]),
      facts({ projectionByPlayerId: new Map() }, 'complete'),
      NOW,
    );

    expect(lineup.projected).toBeNull();
    expect(lineup.starters[0]!.projected).toBeNull();
    expect(lineup.points).toBe(27);
  });
});

describe('buildRoundLineups', () => {
  const factsByWeek = new Map([
    [9, facts({}, 'in_game')],
    [10, facts()],
  ]);
  const plan = (week: number, isOptimal = false) => ({
    week,
    starters: ['1', '2'],
    isOptimal,
  });

  it('projects a week yet to start from its planned lineup', () => {
    const lineups = buildRoundLineups(
      { teamGames: [teamGame([12, 3])], planned: [plan(10)] },
      [9, 10],
      factsByWeek,
      NOW,
    );

    expect(lineups.map(l => [l.week, l.points, l.placeholder])).toEqual([
      [9, 15, null],
      [10, 0, 'sleeper'],
    ]);
    expect(lineups[1]!.projected).toBe(30);
    expect(lineups[1]!.starters[0]).toMatchObject({
      name: 'Ann',
      points: 0,
      state: 'pre_game',
    });
    expect(roundTotal(lineups)).toEqual({ points: 15, projected: 60 });
  });

  it('projects the first week of a round before it has a score', () => {
    const lineups = buildRoundLineups(
      { teamGames: [], planned: [plan(9, true), plan(10, true)] },
      [9, 10],
      new Map([
        [9, facts()],
        [10, facts()],
      ]),
      NOW,
    );

    expect(lineups.map(l => l.placeholder)).toEqual(['optimal', 'optimal']);
    expect(roundTotal(lineups)).toEqual({ points: 0, projected: 60 });
  });

  it('replaces the planned lineup once the week has a played one', () => {
    const lineups = buildRoundLineups(
      {
        teamGames: [teamGame([12, 3]), { ...teamGame([1, 1]), week: 10 }],
        planned: [plan(10)],
      },
      [9, 10],
      factsByWeek,
      NOW,
    );

    expect(lineups[1]).toMatchObject({ points: 2, placeholder: null });
  });

  it('keeps the planned lineup over a stored week with nothing in it', () => {
    const emptyRow = { ...teamGame([], []), week: 10 };
    const lineups = buildRoundLineups(
      { teamGames: [emptyRow], planned: [plan(10)] },
      [10],
      factsByWeek,
      NOW,
    );

    expect(lineups[0]).toMatchObject({ placeholder: 'sleeper', projected: 30 });
  });

  it('keeps the planned lineup over a stale row from a full resync', () => {
    const staleRow = { ...teamGame([0, 0], ['3', '3']), week: 10 };
    const lineups = buildRoundLineups(
      { teamGames: [staleRow], planned: [plan(10)] },
      [10],
      factsByWeek,
      NOW,
    );

    expect(lineups[0]).toMatchObject({ placeholder: 'sleeper', projected: 30 });
  });

  it('ignores a stale row with no planned lineup to replace it', () => {
    const staleRow = { ...teamGame([0, 0]), week: 10 };
    const lineups = buildRoundLineups(
      { teamGames: [staleRow], planned: [] },
      [10],
      factsByWeek,
      NOW,
    );

    expect(lineups[0]).toMatchObject({ starters: [], projected: null });
  });

  it('trusts a stored lineup with no points once the week is underway', () => {
    const lineups = buildRoundLineups(
      { teamGames: [teamGame([0, 0])], planned: [plan(9)] },
      [9],
      factsByWeek,
      NOW,
    );

    expect(lineups[0]).toMatchObject({ placeholder: null, points: 0 });
  });

  it('shows the actual lineup over an optimal one once the week starts', () => {
    const lineups = buildRoundLineups(
      {
        teamGames: [teamGame([0, 0], ['1', '3'])],
        planned: [plan(9, true)],
      },
      [9],
      factsByWeek,
      NOW,
    );

    expect(lineups[0]!.placeholder).toBeNull();
    expect(lineups[0]!.starters.map(s => s.name)).toEqual(['Ann', 'Cy']);
  });

  it('has no projection for a week with no lineup of either kind', () => {
    const lineups = buildRoundLineups(
      { teamGames: [teamGame([12, 3])], planned: [] },
      [9, 10],
      factsByWeek,
      NOW,
    );

    expect(lineups[1]).toMatchObject({ starters: [], projected: null });
    expect(roundTotal(lineups).projected).toBeNull();
  });
});

describe('chooseLineup', () => {
  const roster = {
    players: ['qb1', 'qb2', 'rb1', 'rb2'],
    rosterPositions: ['QB', 'RB', 'BN', 'BN'],
    projectionBySleeperId: new Map([
      ['qb1', 12],
      ['qb2', 20],
      ['rb1', 9],
      ['rb2', 5],
    ]),
    positionBySleeperId: new Map([
      ['qb1', 'QB'],
      ['qb2', 'QB'],
      ['rb1', 'RB'],
      ['rb2', 'RB'],
    ]),
    hasGame: () => true,
  };

  it('keeps a full lineup with everyone playing, even if a better one exists', () => {
    expect(chooseLineup({ ...roster, starters: ['qb1', 'rb2'] })).toEqual({
      starters: ['qb1', 'rb2'],
      isOptimal: false,
    });
  });

  it('picks the best projected lineup when Sleeper has none', () => {
    const best = { starters: ['qb2', 'rb1'], isOptimal: true };

    expect(chooseLineup({ ...roster, starters: [] })).toEqual(best);
    expect(chooseLineup({ ...roster, starters: ['0', '0'] })).toEqual(best);
  });

  it('picks the best projected lineup when a starter has a gap', () => {
    expect(chooseLineup({ ...roster, starters: ['qb1', '0'] })).toEqual({
      starters: ['qb2', 'rb1'],
      isOptimal: true,
    });
  });

  it('picks the best projected lineup when a starter is on bye, without them', () => {
    expect(
      chooseLineup({
        ...roster,
        starters: ['qb1', 'rb1'],
        hasGame: id => id !== 'rb1',
      }),
    ).toEqual({ starters: ['qb2', 'rb2'], isOptimal: true });
  });

  it('keeps what Sleeper has when there are no projections to choose on', () => {
    const none = { ...roster, projectionBySleeperId: new Map() };

    expect(
      chooseLineup({ ...none, starters: ['qb1', 'rb1'], hasGame: () => false }),
    ).toEqual({ starters: ['qb1', 'rb1'], isOptimal: false });
    expect(chooseLineup({ ...none, starters: [] })).toBeNull();
  });
});

const week = (overrides: Partial<WeekLineup>): WeekLineup => ({
  week: 9,
  points: 0,
  projected: 100,
  finished: false,
  placeholder: null,
  starters: [],
  ...overrides,
});

describe('roundTotal', () => {
  it('adds a finished week to the one still going', () => {
    const total = roundTotal([
      week({ week: 9, points: 130, projected: 130, finished: true }),
      week({ week: 10, points: 40, projected: 110 }),
    ]);

    expect(total).toEqual({ points: 170, projected: 240 });
  });

  it('matches the score once the whole round is over', () => {
    const total = roundTotal([
      week({ week: 9, points: 130, projected: 130, finished: true }),
      week({ week: 10, points: 90, projected: 90, finished: true }),
    ]);

    expect(total).toEqual({ points: 220, projected: 220 });
  });

  it('has no projection when a week has none, rather than half of one', () => {
    const total = roundTotal([
      week({ week: 9 }),
      week({ week: 10, projected: null }),
    ]);

    expect(total.projected).toBeNull();
  });

  it('has no projection for a round with no weeks', () => {
    expect(roundTotal([]).projected).toBeNull();
  });
});
