import {
  classifyBracket,
  finishLabelForPlace,
  placesForPlacementGame,
  type SleeperBracketEntry,
} from './bracket';
import fs from 'fs';
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

const fixture = (name: string): SleeperBracketEntry[] =>
  JSON.parse(fs.readFileSync(`test/fixtures/sleeper/${name}.json`, 'utf8'));

describe('classifyBracket', () => {
  it('returns every game, consolation games included', () => {
    expect(classifyBracket(sixTeamBracket, 'WINNERS').games).toHaveLength(6);
  });

  it('marks only the p:1 game as the title game', () => {
    const games = byMatchup(classifyBracket(sixTeamBracket, 'WINNERS'));

    expect(games.get(5)!.isTitleGame).toBe(true);
    expect(games.get(6)!.isTitleGame).toBe(false);
    expect(games.get(3)!.isTitleGame).toBe(false);
  });

  it('counts the final and every game feeding it', () => {
    const games = byMatchup(classifyBracket(sixTeamBracket, 'WINNERS'));

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
    const games = byMatchup(classifyBracket(sixTeamBracket, 'WINNERS'));

    expect(games.get(6)!.countsTowardRecord).toBe(false);
    expect(games.get(6)!.placement).toBe(3);
  });

  it('carries roster ids and results through', () => {
    const final = byMatchup(classifyBracket(sixTeamBracket, 'WINNERS')).get(5)!;

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
    const { games } = classifyBracket(
      [
        { r: 1, m: 1, t1: 3, t2: 6 },
        { r: 2, m: 2, t1_from: { w: 1 }, p: 1 },
      ],
      'WINNERS',
    );

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
      classifyBracket(
        [
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
        ],
        'WINNERS',
      ),
    );

    expect(games.get(3)!.isTitleGame).toBe(true);
    expect(games.get(1)!.countsTowardRecord).toBe(true);
    expect(games.get(2)!.countsTowardRecord).toBe(true);
  });

  it('returns nothing for an empty bracket', () => {
    expect(classifyBracket([], 'WINNERS').games).toEqual([]);
  });

  // A bye means the title path is shorter on one side; the other side must
  // still be walked in full.
  it('walks past a bye without losing the other half of the bracket', () => {
    const games = byMatchup(
      classifyBracket(
        [
          { r: 1, m: 1, t1: 2, t2: 3, w: 2, l: 3 },
          { r: 2, m: 2, t1: 1, t2: 2, w: 1, l: 2, t2_from: { w: 1 }, p: 1 },
        ],
        'WINNERS',
      ),
    );

    expect(games.get(1)!.countsTowardRecord).toBe(true);
    expect(games.get(2)!.isTitleGame).toBe(true);
  });

  // External data: a malformed bracket must not hang the sync.
  it('terminates on a bracket that points at itself', () => {
    const { games } = classifyBracket(
      [{ r: 1, m: 1, t1_from: { w: 1 }, p: 1 }],
      'WINNERS',
    );

    expect(games).toHaveLength(1);
    expect(games[0].countsTowardRecord).toBe(true);
  });

  // A dangling _from reference should be ignored rather than throw.
  it('ignores a reference to a game that is not in the bracket', () => {
    const { games } = classifyBracket(
      [{ r: 2, m: 2, t1_from: { w: 99 }, t2_from: { w: 98 }, p: 1 }],
      'WINNERS',
    );

    expect(games[0].countsTowardRecord).toBe(true);
  });
});

/**
 * Real payloads, captured from Sleeper for the 2018 Champions league
 * (`335507311525122048`). Twelve teams, six playoff spots, so the winners
 * bracket decides places 1-6 and the losers bracket decides 7-12.
 *
 * These are the authority: the classifier was rewritten after these showed the
 * previous reading of the losers bracket was wrong.
 */
describe('classifyBracket against real Sleeper brackets', () => {
  const winners = fixture('winners-bracket-2018-champions');
  const losers = fixture('losers-bracket-2018-champions');

  describe('winners bracket', () => {
    const games = byMatchup(classifyBracket(winners, 'WINNERS'));

    it('crowns the winner of the p:1 game', () => {
      expect(games.get(6)!.isTitleGame).toBe(true);
      expect(games.get(6)!.advancingRosterId).toBe(4);
    });

    it('counts the title run and nothing else', () => {
      for (const m of [1, 2, 3, 4, 6]) {
        expect(games.get(m)!.countsTowardRecord).toBe(true);
      }
    });

    // Reached by losing a semifinal, so neither counts - the rule the league
    // asked for.
    it('excludes the third and fifth place games', () => {
      expect(games.get(7)!.placement).toBe(3);
      expect(games.get(7)!.countsTowardRecord).toBe(false);
      expect(games.get(5)!.placement).toBe(5);
      expect(games.get(5)!.countsTowardRecord).toBe(false);
    });
  });

  /**
   * Scores for this bracket's weeks (playoffs started week 14 in 2018, so
   * rounds 1-3 are weeks 14-16), checked against `TeamGame`:
   *
   *   m1  1 (84.86) v  8 (131.78)   m2  9 (82.94) v 6 (146.40)
   *   m3  7 (69.00) v  1 (68.48)    m4 10 (51.53) v 9 (87.77)
   *   m5  8 (83.53) v  6 (79.14)    m6  1 (113.04) v 10 (86.44)
   *   m7  7 (95.60) v  9 (69.49)
   *
   * Sleeper's `w` is the *lower* scorer in all seven, which is the convention
   * this bracket exists to pin down.
   */
  describe('losers bracket', () => {
    const games = byMatchup(classifyBracket(losers, 'LOSERS'));

    // Roster 10 scored 86.44 against roster 1's 113.04 and is recorded by
    // Sleeper as the winner, because in a toilet bowl you advance by losing.
    it('gives the sacko to the p:1 game, the last game of the bracket', () => {
      const sackoGame = games.get(6)!;

      expect(sackoGame.placement).toBe(1);
      expect(sackoGame.isTitleGame).toBe(true);
      expect(sackoGame.advancingRosterId).toBe(10);
    });

    // The sporting result, which is the opposite of Sleeper's `w` here.
    it('records the higher scorer as the winner of the game', () => {
      expect(games.get(6)!.winningRosterId).toBe(1);
      expect(games.get(6)!.losingRosterId).toBe(10);
    });

    it('does not treat the highest placement marker as the sacko game', () => {
      expect(games.get(5)!.placement).toBe(5);
      expect(games.get(5)!.isTitleGame).toBe(false);
    });

    // Roster 10 lost m4 on points, which fed m6 via `t2_from: {w: 4}`, then
    // lost m6. The road to the sacko is the road Sleeper marks with `w`.
    it('counts the defeats that carried the sacko there', () => {
      for (const m of [1, 2, 3, 4, 6]) {
        expect(games.get(m)!.countsTowardRecord).toBe(true);
      }
    });

    it('excludes the games deciding seventh through tenth', () => {
      for (const m of [5, 7]) {
        expect(games.get(m)!.countsTowardRecord).toBe(false);
      }
    });

    it('advances the lower scorer of every game toward the bottom', () => {
      expect(games.get(1)!.advancingRosterId).toBe(1);
      expect(games.get(2)!.advancingRosterId).toBe(9);
    });
  });

  // Every placement game covers two finishing spots, and across both brackets
  // they must account for all twelve teams exactly once. This is what proves
  // the losers bracket's p:1 means last rather than seventh: read the other way
  // the two brackets would both claim places 1-6.
  it('accounts for all twelve places exactly once', () => {
    const TEAM_COUNT = 12;
    const absolute = (
      bracket: ReturnType<typeof classifyBracket>,
      kind: 'WINNERS' | 'LOSERS',
    ) =>
      bracket.games
        .filter(game => game.placement !== null)
        .flatMap(game => {
          const places = placesForPlacementGame({
            bracket: kind,
            placement: game.placement!,
            teamCount: TEAM_COUNT,
          })!;
          return [places.advancingPlace, places.otherPlace];
        });

    const places = [
      ...absolute(classifyBracket(winners, 'WINNERS'), 'WINNERS'),
      ...absolute(classifyBracket(losers, 'LOSERS'), 'LOSERS'),
    ].sort((a, b) => a - b);

    expect(places).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  // A second real league, to show the reading is not a quirk of one bracket.
  describe('the 2020 Admiral losers bracket', () => {
    const admiral = fixture('losers-bracket-2020-admiral');
    const games = byMatchup(classifyBracket(admiral, 'LOSERS'));

    // m6: roster 9 scored 60.6 against roster 11's 132.4 and took the sacko.
    it('names roster 9 the sacko', () => {
      expect(games.get(6)!.isTitleGame).toBe(true);
      expect(games.get(6)!.advancingRosterId).toBe(9);
      expect(games.get(6)!.winningRosterId).toBe(11);
    });

    it('seats the whole bracket from the placement games', () => {
      const seat = (m: number) => {
        const game = games.get(m)!;
        const places = placesForPlacementGame({
          bracket: 'LOSERS',
          placement: game.placement!,
          teamCount: 12,
        })!;
        return {
          [game.advancingRosterId!]: places.advancingPlace,
          [game.winningRosterId!]: places.otherPlace,
        };
      };

      expect({ ...seat(5), ...seat(7), ...seat(6) }).toEqual({
        4: 7,
        2: 8,
        12: 9,
        10: 10,
        11: 11,
        9: 12,
      });
    });
  });
});

describe('placesForPlacementGame', () => {
  const winners = (placement: number) =>
    placesForPlacementGame({ bracket: 'WINNERS', placement, teamCount: 12 });
  const losers = (placement: number) =>
    placesForPlacementGame({ bracket: 'LOSERS', placement, teamCount: 12 });

  it('seats the winners bracket from the top', () => {
    expect(winners(1)).toEqual({ advancingPlace: 1, otherPlace: 2 });
    expect(winners(3)).toEqual({ advancingPlace: 3, otherPlace: 4 });
    expect(winners(5)).toEqual({ advancingPlace: 5, otherPlace: 6 });
  });

  it('seats the losers bracket from the bottom', () => {
    expect(losers(1)).toEqual({ advancingPlace: 12, otherPlace: 11 });
    expect(losers(3)).toEqual({ advancingPlace: 10, otherPlace: 9 });
    expect(losers(5)).toEqual({ advancingPlace: 8, otherPlace: 7 });
  });

  it('refuses a placement that would seat someone outside the league', () => {
    expect(winners(12)).toBeNull();
    expect(losers(12)).toBeNull();
    expect(winners(0)).toBeNull();
  });

  it('refuses a league too small to have places', () => {
    expect(
      placesForPlacementGame({
        bracket: 'WINNERS',
        placement: 1,
        teamCount: 1,
      }),
    ).toBeNull();
  });
});

describe('finishLabelForPlace', () => {
  const label = (place: number) => finishLabelForPlace(place, 12);

  it('names the places that have names', () => {
    expect(label(1)).toBe('Champion');
    expect(label(2)).toBe('Runner Up');
    expect(label(3)).toBe('Semifinalist');
    expect(label(4)).toBe('Semifinalist');
    expect(label(5)).toBe('Quarterfinalist');
    expect(label(6)).toBe('Quarterfinalist');
    expect(label(11)).toBe('Sacko Finalist');
    expect(label(12)).toBe('Sacko');
  });

  // There is no word for finishing ninth.
  it('falls back to an ordinal in between', () => {
    expect(label(7)).toBe('7th');
    expect(label(8)).toBe('8th');
    expect(label(9)).toBe('9th');
    expect(label(10)).toBe('10th');
  });

  // The sacko places win, so a tiny league cannot report two semifinalists and
  // no sacko.
  it('prefers the sacko names when a small league overlaps', () => {
    expect(finishLabelForPlace(4, 4)).toBe('Sacko');
    expect(finishLabelForPlace(3, 4)).toBe('Sacko Finalist');
  });
});

describe('classifyBracket, a losers bracket with no placement markers', () => {
  // Crediting the wrong member with the sacko is worse than crediting nobody.
  it('names no sacko rather than guessing', () => {
    const { games } = classifyBracket(
      [
        { r: 1, m: 1, t1: 1, t2: 2, w: 1, l: 2 },
        { r: 2, m: 2, t1: 1, t2: 3, w: 1, l: 3, t1_from: { l: 1 } },
      ],
      'LOSERS',
    );

    expect(games.some(game => game.isTitleGame)).toBe(false);
    expect(games.every(game => !game.countsTowardRecord)).toBe(true);
  });
});
