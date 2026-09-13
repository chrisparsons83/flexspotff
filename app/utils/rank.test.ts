import { assignCompetitionRanks } from './rank';
import { describe, expect, it } from 'vitest';

const points = (value: number) => ({ points: value });

describe('assignCompetitionRanks', () => {
  it('numbers distinct scores in order', () => {
    const ranked = assignCompetitionRanks(
      [points(30), points(20), points(10)],
      entry => entry.points,
    );

    expect(ranked.map(entry => entry.rank)).toEqual([1, 2, 3]);
  });

  // The league boards used to number the sorted rows, so a tie showed as 4th
  // and 5th with nothing separating them.
  it('gives tied scores the same rank and skips the ranks they consume', () => {
    const ranked = assignCompetitionRanks(
      [points(30), points(20), points(20), points(10)],
      entry => entry.points,
    );

    expect(ranked.map(entry => entry.rank)).toEqual([1, 2, 2, 4]);
  });

  it('handles a tie at the top', () => {
    const ranked = assignCompetitionRanks(
      [points(30), points(30), points(10)],
      entry => entry.points,
    );

    expect(ranked.map(entry => entry.rank)).toEqual([1, 1, 3]);
  });

  it('keeps the original fields alongside the rank', () => {
    const ranked = assignCompetitionRanks(
      [{ name: 'greg_irl', points: 30 }],
      entry => entry.points,
    );

    expect(ranked[0]).toEqual({ name: 'greg_irl', points: 30, rank: 1 });
  });

  it('returns nothing for an empty list', () => {
    expect(assignCompetitionRanks([], () => 0)).toEqual([]);
  });
});
