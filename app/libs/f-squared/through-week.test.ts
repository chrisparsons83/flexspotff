import { fSquaredThroughWeek } from './through-week';
import { describe, expect, it } from 'vitest';

const games = (...scores: number[]) =>
  scores.map((pointsScored, index) => ({ week: index + 1, pointsScored }));

describe('fSquaredThroughWeek', () => {
  it('stops at the week the totals reach, not the newest live score', () => {
    expect(
      fSquaredThroughWeek([
        { pointsFor: 200, games: games(100, 100, 90) },
        { pointsFor: 180, games: games(90, 90, 80) },
      ]),
    ).toBe(2);
  });

  it('allows for a stat correction', () => {
    expect(
      fSquaredThroughWeek([{ pointsFor: 201, games: games(100, 100, 90) }]),
    ).toBe(2);
  });

  it('is not moved forward by unplayed weeks', () => {
    expect(
      fSquaredThroughWeek([{ pointsFor: 200, games: games(100, 100, 0, 0) }]),
    ).toBe(2);
  });

  it('ignores playoff weeks the totals leave out', () => {
    expect(
      fSquaredThroughWeek([{ pointsFor: 200, games: games(100, 100, 100) }]),
    ).toBe(2);
  });

  it('has no week before any points are counted', () => {
    expect(
      fSquaredThroughWeek([{ pointsFor: 0, games: games(90) }]),
    ).toBeNull();
    expect(fSquaredThroughWeek([])).toBeNull();
  });
});
