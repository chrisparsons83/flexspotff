import { classifyBracket, type SleeperBracketEntry } from './bracket';
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

  describe('losers bracket', () => {
    const games = byMatchup(classifyBracket(losers, 'LOSERS'));

    /**
     * The heart of it. Placement numbering restarts per bracket, so this
     * bracket's p:1 decides *seventh* - the best of the teams who missed the
     * playoffs. Roster 10 wins that game and is emphatically not the sacko.
     */
    it('does not treat the p:1 winner as the sacko', () => {
      expect(games.get(6)!.placement).toBe(1);
      expect(games.get(6)!.isTitleGame).toBe(false);
      expect(games.get(6)!.winningRosterId).toBe(10);
    });

    it('gives the sacko to the loser of the highest placement game', () => {
      const sackoGame = games.get(5)!;

      expect(sackoGame.placement).toBe(5);
      expect(sackoGame.isTitleGame).toBe(true);
      expect(sackoGame.winningRosterId).toBe(6);
      // Roster 8 lost it, so roster 8 finished twelfth of twelve.
      expect(sackoGame.advancingRosterId).toBe(8);
    });

    // Roster 8 lost m1, which fed m5 via `t1_from: {l: 1}`, then lost m5. The
    // road to the sacko really is the losing road.
    it('counts the defeats that carried the sacko there', () => {
      expect(games.get(1)!.countsTowardRecord).toBe(true);
      expect(games.get(2)!.countsTowardRecord).toBe(true);
      expect(games.get(5)!.countsTowardRecord).toBe(true);
    });

    it('excludes the games deciding seventh through tenth', () => {
      for (const m of [3, 4, 6, 7]) {
        expect(games.get(m)!.countsTowardRecord).toBe(false);
      }
    });

    it('advances the loser of every game toward the bottom', () => {
      expect(games.get(1)!.advancingRosterId).toBe(8);
      expect(games.get(2)!.advancingRosterId).toBe(6);
    });
  });

  // Every placement game covers two finishing spots, and across both brackets
  // they must account for all twelve teams exactly once. This is what proves
  // p:1 in the losers bracket means seventh rather than last.
  it('accounts for all twelve places exactly once', () => {
    // The winners bracket decides places 1-6 directly. The losers bracket
    // restarts its numbering, so its places sit six lower - which is exactly
    // why its p:1 is seventh overall and not first.
    const PLAYOFF_TEAMS = 6;
    const absolute = (
      games: ReturnType<typeof classifyBracket>['games'],
      offset: number,
    ) =>
      games
        .filter(game => game.placement !== null)
        .flatMap(game => [
          game.placement! + offset,
          game.placement! + offset + 1,
        ]);

    const places = [
      ...absolute(classifyBracket(winners, 'WINNERS').games, 0),
      ...absolute(classifyBracket(losers, 'LOSERS').games, PLAYOFF_TEAMS),
    ].sort((a, b) => a - b);

    expect(places).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
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
