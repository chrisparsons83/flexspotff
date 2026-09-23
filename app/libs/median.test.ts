import { deriveMedianRecords, medianOf } from './median';
import { describe, expect, it } from 'vitest';

describe('medianOf', () => {
  it('averages the middle pair of an even set', () => {
    expect(medianOf([1, 2, 3, 4])).toBe(2.5);
  });

  it('takes the middle of an odd set', () => {
    expect(medianOf([5, 1, 3])).toBe(3);
  });

  it('does not care what order it is given', () => {
    expect(medianOf([100, 20, 80, 40])).toBe(60);
  });

  // Twelve scores where the middle two are equal - the case that decides
  // whether anyone can tie the median at all.
  it('handles a repeated middle value', () => {
    expect(medianOf([1, 2, 3, 3, 4, 5])).toBe(3);
  });

  it('is zero for nothing at all', () => {
    expect(medianOf([])).toBe(0);
  });
});

describe('deriveMedianRecords', () => {
  const week = (weekNumber: number, scores: Record<string, number>) =>
    Object.entries(scores).map(([teamId, pointsScored]) => ({
      teamId,
      week: weekNumber,
      pointsScored,
    }));

  it('scores each team against its own week', () => {
    // Median of week 1 is 30, of week 2 is 20.
    const records = deriveMedianRecords([
      ...week(1, { a: 10, b: 20, c: 40, d: 50 }),
      ...week(2, { a: 30, b: 10, c: 25, d: 15 }),
    ]);

    expect(records.get('a')).toEqual({
      medianWins: 1,
      medianLosses: 1,
      medianTies: 0,
    });
    expect(records.get('c')).toEqual({
      medianWins: 2,
      medianLosses: 0,
      medianTies: 0,
    });
    expect(records.get('b')).toEqual({
      medianWins: 0,
      medianLosses: 2,
      medianTies: 0,
    });
  });

  it('ties a team that lands exactly on the median', () => {
    const records = deriveMedianRecords(week(1, { a: 10, b: 20, c: 20 }));

    expect(records.get('b')).toEqual({
      medianWins: 0,
      medianLosses: 0,
      medianTies: 1,
    });
  });

  // A week nobody has played yet would otherwise hand every team a loss
  // against a median of nothing.
  it('skips a week where nobody scored', () => {
    const records = deriveMedianRecords([
      ...week(1, { a: 10, b: 20 }),
      ...week(2, { a: 0, b: 0 }),
    ]);

    expect(records.get('a')).toEqual({
      medianWins: 0,
      medianLosses: 1,
      medianTies: 0,
    });
  });

  it('skips a week with only one team in it', () => {
    const records = deriveMedianRecords(week(1, { a: 10 }));

    expect(records.get('a')).toBeUndefined();
  });

  it('returns nothing for no rows', () => {
    expect(deriveMedianRecords([]).size).toBe(0);
  });
});
