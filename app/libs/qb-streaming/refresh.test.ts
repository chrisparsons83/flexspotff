import type { RefreshGame, RefreshOption, RefreshQb } from './refresh';
import { planQbStreamingRefresh, qbStreamingOpensAt } from './refresh';
import { describe, expect, it } from 'vitest';

const now = new Date('2026-11-05T12:00:00Z');
const later = new Date('2026-11-08T18:00:00Z');
const earlier = new Date('2026-11-05T01:15:00Z');

const games: RefreshGame[] = [
  { id: 'g-sun', homeTeamId: 'NYG', awayTeamId: 'DAL', gameStartTime: later },
  { id: 'g-thu', homeTeamId: 'KC', awayTeamId: 'DEN', gameStartTime: earlier },
];

const qb = (id: string, team: string | null): RefreshQb => ({
  id,
  sleeperId: `s-${id}`,
  currentNFLTeamId: team,
});

const option = (
  playerId: string,
  overrides: Partial<RefreshOption> = {},
): RefreshOption => ({
  id: `o-${playerId}`,
  playerId,
  sleeperId: `s-${playerId}`,
  removedAt: null,
  gameStartTime: later,
  pickCount: 0,
  ...overrides,
});

const plan = (args: {
  qbs?: RefreshQb[];
  owned?: Record<string, number>;
  projected?: Record<string, number | null>;
  options?: RefreshOption[];
}) =>
  planQbStreamingRefresh({
    qbs: args.qbs ?? [],
    rostership: Object.fromEntries(
      Object.entries(args.owned ?? {}).map(([id, owned]) => [
        `s-${id}`,
        { owned },
      ]),
    ),
    projections: Object.fromEntries(
      Object.entries(args.projected ?? {}).map(([id, pts]) => [
        `s-${id}`,
        { pts_half_ppr: pts },
      ]),
    ),
    games,
    options: args.options ?? [],
    now,
  });

describe('planQbStreamingRefresh', () => {
  it('adds QBs under 50% rostered and projected over 1, deep under 25%', () => {
    const result = plan({
      qbs: [qb('deep', 'NYG'), qb('std', 'DAL'), qb('owned', 'NYG')],
      owned: { deep: 10, std: 30, owned: 50 },
      projected: { deep: 12, std: 15, owned: 20 },
    });

    expect(result.add).toEqual([
      { playerId: 'deep', isDeep: true, nflGameId: 'g-sun' },
      { playerId: 'std', isDeep: false, nflGameId: 'g-sun' },
    ]);
  });

  it('skips QBs projected at 1 or less, with no game, or no team', () => {
    const result = plan({
      qbs: [qb('low', 'NYG'), qb('bye', 'SEA'), qb('fa', null)],
      owned: { low: 5, bye: 5, fa: 5 },
      projected: { low: 1, bye: 15, fa: 15 },
    });

    expect(result.add).toEqual([]);
  });

  it('only adds QBs whose game has not started yet', () => {
    const result = plan({
      qbs: [qb('thu', 'KC')],
      owned: { thu: 5 },
      projected: { thu: 15 },
    });

    expect(result.add).toEqual([]);
  });

  it('never re-adds or re-pools a QB already in the week', () => {
    // Rostership moved past 25% since they were added in the deep pool.
    const result = plan({
      qbs: [qb('a', 'NYG')],
      owned: { a: 40 },
      projected: { a: 15 },
      options: [option('a')],
    });

    expect(result).toEqual({ add: [], restore: [], remove: [] });
  });

  it('removes an unpicked QB Sleeper projects at exactly 0', () => {
    const result = plan({
      options: [option('out')],
      projected: { out: 0 },
    });

    expect(result.remove).toEqual(['o-out']);
  });

  it('keeps a QB with no projection, a pick, or a started game', () => {
    const result = plan({
      options: [
        option('missing'),
        option('null'),
        option('picked', { pickCount: 1 }),
        option('started', { gameStartTime: earlier }),
      ],
      projected: { null: null, picked: 0, started: 0 },
    });

    expect(result.remove).toEqual([]);
  });

  it('brings a hidden QB back when they qualify again, without re-adding', () => {
    const result = plan({
      qbs: [qb('back', 'NYG')],
      owned: { back: 40 },
      projected: { back: 14 },
      options: [option('back', { removedAt: earlier })],
    });

    expect(result).toEqual({ add: [], restore: ['o-back'], remove: [] });
  });

  it('brings back a hidden QB somebody has picked', () => {
    const result = plan({
      options: [option('picked', { removedAt: earlier, pickCount: 1 })],
      projected: { picked: 0 },
    });

    expect(result.restore).toEqual(['o-picked']);
  });

  it('leaves a hidden QB hidden while they still do not qualify', () => {
    const result = plan({
      qbs: [qb('out', 'NYG')],
      owned: { out: 5 },
      projected: { out: 0 },
      options: [option('out', { removedAt: earlier })],
    });

    expect(result).toEqual({ add: [], restore: [], remove: [] });
  });
});

describe('qbStreamingOpensAt', () => {
  it('opens at 8am Eastern the Wednesday before a Thursday night game', () => {
    // Thursday 8:15pm EST is Friday 01:15 UTC.
    expect(
      qbStreamingOpensAt(new Date('2026-11-06T01:15:00Z')).toISOString(),
    ).toBe('2026-11-04T13:00:00.000Z');
  });

  it('holds 8am Eastern on daylight time too', () => {
    // Thursday 10 September 2026, 8:20pm EDT.
    expect(
      qbStreamingOpensAt(new Date('2026-09-11T00:20:00Z')).toISOString(),
    ).toBe('2026-09-09T12:00:00.000Z');
  });

  it('opens the same morning when the first game is on a Wednesday', () => {
    // Wednesday 25 December 2024, 1pm EST.
    expect(
      qbStreamingOpensAt(new Date('2024-12-25T18:00:00Z')).toISOString(),
    ).toBe('2024-12-25T13:00:00.000Z');
  });

  it('goes back to Wednesday for a week that starts on a Saturday', () => {
    // Saturday 9 January 2027, 4:30pm EST.
    expect(
      qbStreamingOpensAt(new Date('2027-01-09T21:30:00Z')).toISOString(),
    ).toBe('2027-01-06T13:00:00.000Z');
  });
});
