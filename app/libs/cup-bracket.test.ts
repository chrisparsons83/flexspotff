import { decideCupGame } from './cup-bracket';
import { describe, expect, it } from 'vitest';

describe('decideCupGame', () => {
  it('advances whoever scored more', () => {
    expect(
      decideCupGame({
        topScore: 110.5,
        bottomScore: 98.2,
        topSeed: 12,
        bottomSeed: 5,
      }),
    ).toBe('top');
    expect(
      decideCupGame({
        topScore: 90,
        bottomScore: 91,
        topSeed: 1,
        bottomSeed: 64,
      }),
    ).toBe('bottom');
  });

  // Rule 12.4: a tie goes to the higher seed, which is the lower number. The
  // admin scoring used to hand it to the lower seed instead.
  it('gives a tie to the better seed whichever side of the game they are on', () => {
    expect(
      decideCupGame({
        topScore: 100,
        bottomScore: 100,
        topSeed: 3,
        bottomSeed: 14,
      }),
    ).toBe('top');
    expect(
      decideCupGame({
        topScore: 100,
        bottomScore: 100,
        topSeed: 14,
        bottomSeed: 3,
      }),
    ).toBe('bottom');
  });

  it('treats two-week sums that differ only by float noise as a tie', () => {
    expect(
      decideCupGame({
        topScore: 100.1 + 50.2,
        bottomScore: 150.3,
        topSeed: 20,
        bottomSeed: 9,
      }),
    ).toBe('bottom');
  });

  it('advances the top side when there is no opponent', () => {
    expect(
      decideCupGame({
        topScore: 0,
        bottomScore: 0,
        topSeed: 2,
        bottomSeed: null,
      }),
    ).toBe('top');
  });
});
