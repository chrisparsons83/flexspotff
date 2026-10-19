import { assertSeasonHasDataOrIsCurrent } from './standings';
import { describe, expect, it } from 'vitest';

describe('assertSeasonHasDataOrIsCurrent', () => {
  it('allows a year with data', () => {
    expect(() =>
      assertSeasonHasDataOrIsCurrent(2015, true, 2026, 'Nothing'),
    ).not.toThrow();
  });

  it('allows the current season with no data', () => {
    expect(() =>
      assertSeasonHasDataOrIsCurrent(2026, false, 2026, 'Nothing'),
    ).not.toThrow();
  });

  it('is a 404 for another year with no data', () => {
    expect(() =>
      assertSeasonHasDataOrIsCurrent(2015, false, 2026, 'Nothing'),
    ).toThrow(expect.objectContaining({ status: 404 }));
  });

  it('is a 404 when there is no current season', () => {
    expect(() =>
      assertSeasonHasDataOrIsCurrent(2026, false, undefined, 'Nothing'),
    ).toThrow(expect.objectContaining({ status: 404 }));
  });
});
