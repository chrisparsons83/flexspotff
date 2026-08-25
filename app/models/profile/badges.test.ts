import {
  BADGE_DEFINITIONS,
  makeBadge,
  makeSideGameBadge,
  tierFor,
} from './badges';
import { describe, expect, it } from 'vitest';

describe('tierFor', () => {
  const thresholds = [1, 5, 10];

  it('is zero below the first threshold', () => {
    expect(tierFor(0, thresholds)).toBe(0);
  });

  it('lands in the best band a value qualifies for, not the first', () => {
    expect(tierFor(1, thresholds)).toBe(1);
    expect(tierFor(4, thresholds)).toBe(1);
    expect(tierFor(5, thresholds)).toBe(2);
    expect(tierFor(9, thresholds)).toBe(2);
    expect(tierFor(10, thresholds)).toBe(3);
  });

  it('stays in the top band beyond the last threshold', () => {
    expect(tierFor(50, thresholds)).toBe(3);
  });

  it('fires exactly on a boundary', () => {
    expect(tierFor(150, [150, 175, 200])).toBe(1);
    expect(tierFor(149.99, [150, 175, 200])).toBe(0);
  });
});

describe('makeBadge', () => {
  it('returns nothing when the badge has not been earned', () => {
    expect(makeBadge(BADGE_DEFINITIONS.seasonsPlayed, 0)).toBeNull();
  });

  it('carries the real value alongside the tier', () => {
    const badge = makeBadge(BADGE_DEFINITIONS.seasonsPlayed, 7);

    expect(badge).toMatchObject({ value: 7, tier: 2, tierCount: 3 });
  });

  // The scoring badges band on the score itself, not on how many times it
  // happened.
  it('bands the high scoring week on points', () => {
    expect(makeBadge(BADGE_DEFINITIONS.highScoringWeek, 149)).toBeNull();
    expect(makeBadge(BADGE_DEFINITIONS.highScoringWeek, 176)).toMatchObject({
      tier: 2,
    });
    expect(makeBadge(BADGE_DEFINITIONS.highScoringWeek, 240)).toMatchObject({
      tier: 3,
    });
  });

  it('gives the win streak four bands', () => {
    expect(makeBadge(BADGE_DEFINITIONS.winStreak, 4)).toBeNull();
    expect(makeBadge(BADGE_DEFINITIONS.winStreak, 5)).toMatchObject({
      tier: 1,
      tierCount: 4,
    });
    expect(makeBadge(BADGE_DEFINITIONS.winStreak, 20)).toMatchObject({
      tier: 4,
    });
  });
});

describe('makeSideGameBadge', () => {
  it('is absent for a game never won', () => {
    expect(makeSideGameBadge('spreadPool', 0)).toBeNull();
  });

  it('puts every side game on the same scale', () => {
    expect(makeSideGameBadge('spreadPool', 2)).toMatchObject({
      tier: 2,
      tierCount: 3,
    });
    expect(makeSideGameBadge('dfsSurvivor', 2)).toMatchObject({
      tier: 2,
      tierCount: 3,
    });
  });

  it('keys badges per game so two titles do not collide', () => {
    expect(makeSideGameBadge('locks', 1)!.key).toBe('locks-champion');
    expect(makeSideGameBadge('d12', 1)!.key).toBe('d12-champion');
  });
});
