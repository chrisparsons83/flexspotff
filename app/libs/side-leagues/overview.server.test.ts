import { liveGuillotineSummary } from './overview.server';
import { describe, expect, it } from 'vitest';

const team = (rosterId: number) => ({
  rosterId,
  finish: null,
  choppedWeek: null,
  sleeperDisplayName: `Team ${rosterId}`,
  user: null,
  weekScores: [],
});

const row = (
  rank: number,
  points: number,
  projected: number,
  playersRemaining: number,
  onTheBlock = false,
) => ({
  rosterId: rank,
  rank,
  points,
  projected,
  playersRemaining,
  lineupSet: true,
  onTheBlock,
});

const league = {
  id: 'league',
  name: 'Guillotine',
  teams: [1, 2, 3, 4, 5, 6, 7, 8].map(team),
};

describe('liveGuillotineSummary', () => {
  it('lists every team, with projections while its games are on', () => {
    const summary = liveGuillotineSummary({
      league,
      week: 8,
      live: [
        row(1, 90, 120.26, 2),
        row(2, 80, 100, 1),
        row(3, 70, 95, 0),
        row(4, 60, 80.04, 3),
        row(5, 50, 70.5, 3, true),
      ],
    });

    expect(summary.title).toBe('Guillotine · Week 8');
    expect(summary.status).toBe('');
    expect(
      summary.rows.map(r => [r.rank, r.value, r.detail, r.divider, r.tone]),
    ).toEqual([
      [1, '90.00', 'Proj. 120.3', undefined, undefined],
      [2, '80.00', 'Proj. 100.0', undefined, undefined],
      [3, '70.00', undefined, undefined, undefined],
      [4, '60.00', 'Proj. 80.0', undefined, undefined],
      [5, '50.00', 'Proj. 70.5', 'cut', 'negative'],
    ]);
  });

  it('drops projections once every game is final', () => {
    const summary = liveGuillotineSummary({
      league,
      week: 8,
      live: [row(1, 90, 90, 0), row(2, 80, 80, 0), row(3, 70, 70, 0, true)],
    });

    expect(summary.rows.every(r => r.detail === undefined)).toBe(true);
  });
});
