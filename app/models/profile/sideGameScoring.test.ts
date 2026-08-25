import { locksWeekPoints, topWeeksTotal, winnersOf } from './sideGameScoring';
import { describe, expect, it } from 'vitest';

describe('topWeeksTotal', () => {
  // QB Streaming counts a member's best twelve weeks, so a long season is not
  // simply a bigger total - this is the rule a naive sum would get wrong.
  it('counts only the best weeks', () => {
    const weeks = [30, 10, 25, 5, 20];

    expect(topWeeksTotal(weeks, 3)).toBe(75);
  });

  it('counts everything when there are fewer weeks than the limit', () => {
    expect(topWeeksTotal([10, 20], 12)).toBe(30);
  });

  it('defaults to twelve weeks', () => {
    const weeks = Array.from({ length: 17 }, (_, i) => i + 1);

    // 17 down to 6 - the twelve best of 1..17.
    expect(topWeeksTotal(weeks)).toBe(138);
  });

  it('does not mutate the input', () => {
    const weeks = [1, 9, 5];
    topWeeksTotal(weeks, 2);

    expect(weeks).toEqual([1, 9, 5]);
  });

  it('is zero for a member who entered nothing', () => {
    expect(topWeeksTotal([])).toBe(0);
  });
});

describe('locksWeekPoints', () => {
  it('scores the wins when the week was clean', () => {
    expect(locksWeekPoints({ isWin: 4, isLoss: 0 })).toBe(4);
  });

  // A single loss voids the entire week, however many wins came with it.
  it('voids the whole week on any loss', () => {
    expect(locksWeekPoints({ isWin: 5, isLoss: 1 })).toBe(0);
  });

  it('treats missing values as zero', () => {
    expect(locksWeekPoints({ isWin: null, isLoss: null })).toBe(0);
  });
});

describe('winnersOf', () => {
  it('picks the highest total', () => {
    const totals = new Map([
      ['a', 10],
      ['b', 25],
      ['c', 5],
    ]);

    expect([...winnersOf(totals)]).toEqual(['b']);
  });

  it('crowns everyone on a tie', () => {
    const totals = new Map([
      ['a', 25],
      ['b', 25],
      ['c', 5],
    ]);

    expect([...winnersOf(totals)].sort()).toEqual(['a', 'b']);
  });

  it('has no winner for a season nobody entered', () => {
    expect(winnersOf(new Map()).size).toBe(0);
  });

  // A season where nobody scored has not been played, and crowning the whole
  // league would hand everyone a badge.
  it('has no winner when every total is zero', () => {
    const totals = new Map([
      ['a', 0],
      ['b', 0],
    ]);

    expect(winnersOf(totals).size).toBe(0);
  });

  it('has no winner when every total is negative', () => {
    // The spread pool can go negative; a losing season is still not a win.
    expect(
      winnersOf(
        new Map([
          ['a', -10],
          ['b', -5],
        ]),
      ).size,
    ).toBe(0);
  });
});
