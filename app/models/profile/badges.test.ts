import {
  BADGE_DEFINITIONS,
  describeTier,
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
      scale: 'tally',
      tier: 2,
      tierCount: 2,
    });
    expect(makeSideGameBadge('dfsSurvivor', 2)).toMatchObject({
      scale: 'tally',
      tier: 2,
      tierCount: 2,
    });
  });

  // A side game title is counted, not banded - a fourth is more than a third.
  it('keeps giving stars past where a banded badge would stop', () => {
    expect(makeSideGameBadge('locks', 5)).toMatchObject({
      tier: 5,
      tierCount: 5,
    });
  });

  it('keys badges per game so two titles do not collide', () => {
    expect(makeSideGameBadge('locks', 1)!.key).toBe('locks-champion');
    expect(makeSideGameBadge('d12', 1)!.key).toBe('d12-champion');
  });
});

describe('describeTier', () => {
  it('says what the stars are worth and what the next one costs', () => {
    // seasonsPlayed bands at 1 / 5 / 10.
    const badge = makeBadge(BADGE_DEFINITIONS.seasonsPlayed, 8)!;

    expect(describeTier(badge)).toBe(
      'Seasons in the redraft league (8). 2 of 3 stars. 10 earns the next star.',
    );
  });

  it('says so when there is nothing left to earn', () => {
    const badge = makeBadge(BADGE_DEFINITIONS.seasonsPlayed, 12)!;

    expect(describeTier(badge)).toContain('3 of 3 stars.');
    expect(describeTier(badge)).toContain('This is the top band.');
  });

  // The win streak badge is the only four-band one, so its third star is not
  // the last.
  it('handles a badge with four bands', () => {
    const badge = makeBadge(BADGE_DEFINITIONS.winStreak, 15)!;

    expect(describeTier(badge)).toContain('3 of 4 stars.');
    expect(describeTier(badge)).toContain('20 earns the next star.');
  });
});

describe('a tallied badge', () => {
  const championOfChampions = BADGE_DEFINITIONS.championOfChampions;

  it('gives a star for every win, with no ceiling', () => {
    expect(makeBadge(championOfChampions, 1)).toMatchObject({
      tier: 1,
      tierCount: 1,
    });
    expect(makeBadge(championOfChampions, 2)).toMatchObject({
      tier: 2,
      tierCount: 2,
    });
    // Past where a banded badge would have run out of stars.
    expect(makeBadge(championOfChampions, 6)).toMatchObject({
      tier: 6,
      tierCount: 6,
    });
  });

  it('is absent for a member who has never won it', () => {
    expect(makeBadge(championOfChampions, 0)).toBeNull();
  });

  it('says there is no next band to reach', () => {
    const description = describeTier(makeBadge(championOfChampions, 2)!);

    expect(description).toContain('Won the Champions League title (2)');
    expect(description).toContain('no cap');
    expect(description).not.toContain('of 2 stars');
  });
});
