import {
  classifyBracket,
  detectAdvancementDirection,
  type SleeperBracketEntry,
} from './bracket';
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

const byMatchup = (bracket: ReturnType<typeof classifyBracket>) =>
  new Map(bracket.games.map(game => [game.matchupId, game]));

describe('classifyBracket', () => {
  it('returns every game, consolation games included', () => {
    expect(classifyBracket(sixTeamBracket).games).toHaveLength(6);
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
    const { games } = classifyBracket([
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
    expect(classifyBracket([]).games).toEqual([]);
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
    const { games } = classifyBracket([
      { r: 1, m: 1, t1_from: { w: 1 }, p: 1 },
    ]);

    expect(games).toHaveLength(1);
    expect(games[0].countsTowardRecord).toBe(true);
  });

  // A dangling _from reference should be ignored rather than throw.
  it('ignores a reference to a game that is not in the bracket', () => {
    const { games } = classifyBracket([
      { r: 2, m: 2, t1_from: { w: 99 }, t2_from: { w: 98 }, p: 1 },
    ]);

    expect(games[0].countsTowardRecord).toBe(true);
  });
});

/**
 * The sacko bracket, wired the way a bracket looks when the *loser* moves on:
 * every link is `{l: n}`. You reach the sacko final by scoring least, and the
 * member who scores least there gets the sacko.
 *
 *   m1 (5 beats 6)  ┐ loser 6 advances
 *                   ├─ m3 sacko final: 6 outscores 4, so 4 gets the sacko
 *   m2 (3 beats 4)  ┘ loser 4 advances
 */
const sackoBracket: SleeperBracketEntry[] = [
  { r: 1, m: 1, t1: 5, t2: 6, w: 5, l: 6 },
  { r: 1, m: 2, t1: 3, t2: 4, w: 3, l: 4 },
  {
    r: 2,
    m: 3,
    t1: 6,
    t2: 4,
    w: 6,
    l: 4,
    t1_from: { l: 1 },
    t2_from: { l: 2 },
    p: 1,
  },
];

describe('detectAdvancementDirection', () => {
  it('reads a winners bracket as advancing the winner', () => {
    expect(detectAdvancementDirection(sixTeamBracket)).toBe('w');
  });

  it('reads a sacko bracket as advancing the loser', () => {
    expect(detectAdvancementDirection(sackoBracket)).toBe('l');
  });

  it('defaults to winner when there is nothing to go on', () => {
    expect(detectAdvancementDirection([{ r: 1, m: 1, t1: 1, t2: 2 }])).toBe(
      'w',
    );
    expect(detectAdvancementDirection([])).toBe('w');
  });

  // Teams enter the sacko bracket by losing a winners-bracket game, so its
  // opening round carries `{l: n}` refs pointing at a different bracket. Those
  // must not be counted, or every bracket would look loser-advancing.
  it('ignores links that point outside this bracket', () => {
    const enteredByLosing: SleeperBracketEntry[] = [
      { r: 1, m: 1, t1: 5, t2: 6, w: 5, l: 6, t1_from: { l: 91 } },
      { r: 1, m: 2, t1: 3, t2: 4, w: 3, l: 4, t2_from: { l: 92 } },
      {
        r: 2,
        m: 3,
        t1: 5,
        t2: 3,
        w: 5,
        l: 3,
        t1_from: { w: 1 },
        t2_from: { w: 2 },
      },
    ];

    expect(detectAdvancementDirection(enteredByLosing)).toBe('w');
  });
});

describe('classifyBracket, sacko bracket', () => {
  it('advances the lower scorer', () => {
    const bracket = classifyBracket(sackoBracket);
    const games = byMatchup(bracket);

    expect(bracket.direction).toBe('l');
    // 5 outscored 6, so 6 is the one who moves on toward the sacko.
    expect(games.get(1)!.advancingRosterId).toBe(6);
    expect(games.get(2)!.advancingRosterId).toBe(4);
  });

  // The whole point: the sacko goes to whoever scored least in the final, not
  // to the team Sleeper records as that game's winner.
  it('gives the sacko to the lowest scorer in the final', () => {
    const final = byMatchup(classifyBracket(sackoBracket)).get(3)!;

    expect(final.isTitleGame).toBe(true);
    expect(final.winningRosterId).toBe(6);
    expect(final.advancingRosterId).toBe(4);
  });

  it('counts the games that led to the sacko', () => {
    const games = byMatchup(classifyBracket(sackoBracket));

    expect(games.get(1)!.countsTowardRecord).toBe(true);
    expect(games.get(2)!.countsTowardRecord).toBe(true);
    expect(games.get(3)!.countsTowardRecord).toBe(true);
  });

  // A sacko bracket that Sleeper happens to wire by winner must still land on
  // the right game - that is what detecting the direction buys.
  it('handles a losers bracket wired by winner without a flag', () => {
    const bracket = classifyBracket([
      { r: 1, m: 1, t1: 5, t2: 6, w: 5, l: 6 },
      { r: 2, m: 2, t1: 5, t2: 3, w: 3, l: 5, t1_from: { w: 1 }, p: 1 },
    ]);

    expect(bracket.direction).toBe('w');
    const games = byMatchup(bracket);
    expect(games.get(2)!.isTitleGame).toBe(true);
    expect(games.get(2)!.advancingRosterId).toBe(3);
  });
});

describe('classifyBracket, finding the final', () => {
  // Placement numbering in a losers bracket is ambiguous, so the final is the
  // game nothing advances out of - not whichever game carries p: 1.
  it('prefers the terminal game over a misleading p:1', () => {
    const games = byMatchup(
      classifyBracket([
        // p:1 here would mean "best of the rest", not the last game played.
        { r: 1, m: 1, t1: 1, t2: 2, w: 1, l: 2, p: 1 },
        { r: 2, m: 2, t1: 1, t2: 3, w: 1, l: 3, t1_from: { w: 1 } },
      ]),
    );

    expect(games.get(2)!.isTitleGame).toBe(true);
    expect(games.get(1)!.isTitleGame).toBe(false);
  });

  it('falls back to the highest round when no game carries p', () => {
    const games = byMatchup(
      classifyBracket([
        { r: 1, m: 1, t1: 1, t2: 2, w: 1, l: 2 },
        { r: 3, m: 2, t1: 1, t2: 3, w: 1, l: 3 },
      ]),
    );

    expect(games.get(2)!.isTitleGame).toBe(true);
  });
});
