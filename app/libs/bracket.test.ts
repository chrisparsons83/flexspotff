import { classifyBracket, type SleeperBracketEntry } from './bracket';
import { describe, expect, it } from 'vitest';

/**
 * A six-team bracket in Sleeper's shape: two byes, two first-round games, two
 * semifinals, a final, and a third-place game.
 *
 *   m1 (3v6) ┐
 *            ├─ m3 (semi) ┐
 *      bye 2 ┘            ├─ m5 final       (p: 1)
 *   m2 (4v5) ┐            │
 *            ├─ m4 (semi) ┘
 *      bye 1 ┘
 *            losers of m3 + m4 ─ m6 third place (p: 3)
 */
const sixTeamBracket: SleeperBracketEntry[] = [
  { r: 1, m: 1, t1: 3, t2: 6, w: 3, l: 6 },
  { r: 1, m: 2, t1: 4, t2: 5, w: 5, l: 4 },
  { r: 2, m: 3, t1: 2, t2: 3, w: 2, l: 3, t2_from: { w: 1 } },
  { r: 2, m: 4, t1: 1, t2: 5, w: 1, l: 5, t2_from: { w: 2 } },
  {
    r: 3,
    m: 5,
    t1: 2,
    t2: 1,
    w: 1,
    l: 2,
    t1_from: { w: 3 },
    t2_from: { w: 4 },
    p: 1,
  },
  {
    r: 3,
    m: 6,
    t1: 3,
    t2: 5,
    w: 3,
    l: 5,
    t1_from: { l: 3 },
    t2_from: { l: 4 },
    p: 3,
  },
];

const byMatchup = (games: ReturnType<typeof classifyBracket>) =>
  new Map(games.map(game => [game.matchupId, game]));

describe('classifyBracket', () => {
  it('returns every game, consolation games included', () => {
    expect(classifyBracket(sixTeamBracket)).toHaveLength(6);
  });

  it('marks only the p:1 game as the title game', () => {
    const games = byMatchup(classifyBracket(sixTeamBracket));

    expect(games.get(5)!.isTitleGame).toBe(true);
    expect(games.get(6)!.isTitleGame).toBe(false);
    expect(games.get(3)!.isTitleGame).toBe(false);
  });

  it('counts the final and every game feeding it', () => {
    const games = byMatchup(classifyBracket(sixTeamBracket));

    // Final, both semifinals, and both first-round games that fed them.
    expect(games.get(5)!.countsTowardRecord).toBe(true);
    expect(games.get(3)!.countsTowardRecord).toBe(true);
    expect(games.get(4)!.countsTowardRecord).toBe(true);
    expect(games.get(1)!.countsTowardRecord).toBe(true);
    expect(games.get(2)!.countsTowardRecord).toBe(true);
  });

  // The rule the league actually asked for: winning the third-place game is not
  // a playoff win. It is reached by losing, so the `w`-only walk excludes it.
  it('excludes the third-place game even though it shares the final round', () => {
    const games = byMatchup(classifyBracket(sixTeamBracket));

    expect(games.get(6)!.countsTowardRecord).toBe(false);
    expect(games.get(6)!.placement).toBe(3);
  });

  it('carries roster ids and results through', () => {
    const final = byMatchup(classifyBracket(sixTeamBracket)).get(5)!;

    expect(final).toMatchObject({
      round: 3,
      topRosterId: 2,
      bottomRosterId: 1,
      winningRosterId: 1,
      losingRosterId: 2,
      placement: 1,
    });
  });

  it('handles an unplayed game with no winner yet', () => {
    const games = classifyBracket([
      { r: 1, m: 1, t1: 3, t2: 6 },
      { r: 2, m: 2, t1_from: { w: 1 }, p: 1 },
    ]);

    expect(games[0]).toMatchObject({
      winningRosterId: null,
      losingRosterId: null,
      countsTowardRecord: true,
    });
    expect(games[1]).toMatchObject({
      topRosterId: null,
      isTitleGame: true,
    });
  });

  // Not every bracket carries placement markers.
  it('falls back to the last round when no game is flagged p:1', () => {
    const games = byMatchup(
      classifyBracket([
        { r: 1, m: 1, t1: 1, t2: 4, w: 1, l: 4 },
        { r: 1, m: 2, t1: 2, t2: 3, w: 2, l: 3 },
        {
          r: 2,
          m: 3,
          t1: 1,
          t2: 2,
          w: 1,
          l: 2,
          t1_from: { w: 1 },
          t2_from: { w: 2 },
        },
      ]),
    );

    expect(games.get(3)!.isTitleGame).toBe(true);
    expect(games.get(1)!.countsTowardRecord).toBe(true);
    expect(games.get(2)!.countsTowardRecord).toBe(true);
  });

  it('returns nothing for an empty bracket', () => {
    expect(classifyBracket([])).toEqual([]);
  });

  // A bye means the title path is shorter on one side; the other side must
  // still be walked in full.
  it('walks past a bye without losing the other half of the bracket', () => {
    const games = byMatchup(
      classifyBracket([
        { r: 1, m: 1, t1: 2, t2: 3, w: 2, l: 3 },
        { r: 2, m: 2, t1: 1, t2: 2, w: 1, l: 2, t2_from: { w: 1 }, p: 1 },
      ]),
    );

    expect(games.get(1)!.countsTowardRecord).toBe(true);
    expect(games.get(2)!.isTitleGame).toBe(true);
  });

  // External data: a malformed bracket must not hang the sync.
  it('terminates on a bracket that points at itself', () => {
    const games = classifyBracket([{ r: 1, m: 1, t1_from: { w: 1 }, p: 1 }]);

    expect(games).toHaveLength(1);
    expect(games[0].countsTowardRecord).toBe(true);
  });

  // A dangling _from reference should be ignored rather than throw.
  it('ignores a reference to a game that is not in the bracket', () => {
    const games = classifyBracket([
      { r: 2, m: 2, t1_from: { w: 99 }, t2_from: { w: 98 }, p: 1 },
    ]);

    expect(games[0].countsTowardRecord).toBe(true);
  });
});
