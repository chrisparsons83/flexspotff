import type { WeekFacts, WeekLineup } from './lineups';
import { buildWeekLineup, roundTotal } from './lineups';
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

const week = (overrides: Partial<WeekLineup>): WeekLineup => ({
  week: 9,
  points: 0,
  projected: 100,
  finished: false,
  starters: [],
  ...overrides,
});

describe('roundTotal', () => {
  it('adds a finished week to the one still going', () => {
    const total = roundTotal(
      [
        week({ week: 9, points: 130, projected: 130, finished: true }),
        week({ week: 10, points: 40, projected: 110 }),
      ],
      2,
    );

    expect(total).toEqual({ points: 170, projected: 240 });
  });

  it('matches the score once the whole round is over', () => {
    const total = roundTotal(
      [
        week({ week: 9, points: 130, projected: 130, finished: true }),
        week({ week: 10, points: 90, projected: 90, finished: true }),
      ],
      2,
    );

    expect(total).toEqual({ points: 220, projected: 220 });
  });

  it('has no projection when a week has none, rather than half of one', () => {
    const total = roundTotal(
      [week({ week: 9 }), week({ week: 10, projected: null })],
      2,
    );

    expect(total.projected).toBeNull();
  });

  it('has no projection when a week has no game for the team', () => {
    expect(roundTotal([week({ week: 9 })], 2).projected).toBeNull();
  });
});
