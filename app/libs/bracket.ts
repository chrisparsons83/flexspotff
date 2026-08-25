import { z } from 'zod';

/**
 * Sleeper's bracket format, and the rules for reading a league's postseason out
 * of it.
 *
 * Sleeper returns a bracket as a flat list of games. Each game names the two
 * roster ids playing (`t1`/`t2`), who won and lost (`w`/`l`), and where each
 * side came from (`t1_from`/`t2_from`, pointing at an earlier game by its `m`).
 * Placement games carry a `p`: 1 decides the bracket's title, 3 the third-place
 * game, and so on.
 *
 * A team reaches a placement game like third place by *losing* a semifinal, so
 * "games on the path to the title" cannot be defined by round number. It has to
 * be walked: start at the title game and follow the `_from` links backwards.
 */

/**
 * Where one side of a game came from: the winner (`w`) or loser (`l`) of an
 * earlier game, identified by that game's `m`.
 */
const bracketFromSchema = z
  .object({
    w: z.number().optional(),
    l: z.number().optional(),
  })
  .nullable()
  .optional();

/**
 * Sleeper's bracket entries. Only `r` and `m` are guaranteed - a game that has
 * not been played yet has no winner, and the first round has nothing to come
 * from - so everything else is optional and unknown keys pass through.
 */
export const sleeperBracketJson = z.array(
  z
    .object({
      r: z.number(),
      m: z.number(),
      t1: z.number().nullable().optional(),
      t2: z.number().nullable().optional(),
      w: z.number().nullable().optional(),
      l: z.number().nullable().optional(),
      t1_from: bracketFromSchema,
      t2_from: bracketFromSchema,
      p: z.number().nullable().optional(),
    })
    .passthrough(),
);
export type SleeperBracketJson = z.infer<typeof sleeperBracketJson>;
export type SleeperBracketEntry = SleeperBracketJson[number];

export type AdvancementDirection = 'w' | 'l';

export type ClassifiedBracketGame = {
  round: number;
  matchupId: number;
  placement: number | null;
  /** Decides this bracket's title - the championship, or the sacko. */
  isTitleGame: boolean;
  /** On the path to the title, so it counts toward that bracket's record. */
  countsTowardRecord: boolean;
  topRosterId: number | null;
  bottomRosterId: number | null;
  winningRosterId: number | null;
  losingRosterId: number | null;
  /**
   * Who moved on from this game. In the winners bracket that is whoever
   * outscored their opponent; in the sacko bracket it is whoever scored least,
   * because there you advance by being worse.
   */
  advancingRosterId: number | null;
};

export type ClassifiedBracket = {
  direction: AdvancementDirection;
  games: ClassifiedBracketGame[];
};

/**
 * Works out whether this bracket advances the winner or the loser of each game.
 *
 * The winners bracket advances whoever scored more. The sacko bracket advances
 * whoever scored less - you reach the sacko by being the worst, not by winning
 * a consolation prize. Rather than hardcode that per bracket, it is read back
 * out of the links Sleeper actually emits: a bracket wired `{w: n}` advances
 * winners, one wired `{l: n}` advances losers.
 *
 * Only links that resolve inside this bracket are counted. Teams *enter* the
 * sacko bracket by losing a winners-bracket game, so its opening round carries
 * `{l: n}` references pointing at a different bracket entirely - counting those
 * would make every bracket look loser-advancing.
 */
export function detectAdvancementDirection(
  entries: SleeperBracketEntry[],
): AdvancementDirection {
  const known = new Set(entries.map(entry => entry.m));
  let winnerLinks = 0;
  let loserLinks = 0;

  for (const entry of entries) {
    for (const from of [entry.t1_from, entry.t2_from]) {
      if (from?.w !== undefined && known.has(from.w)) winnerLinks++;
      if (from?.l !== undefined && known.has(from.l)) loserLinks++;
    }
  }

  // Ties and empty brackets fall back to the ordinary reading.
  return loserLinks > winnerLinks ? 'l' : 'w';
}

const advancingFrom = (
  entry: SleeperBracketEntry,
  direction: AdvancementDirection,
): number | null => (direction === 'w' ? entry.w : entry.l) ?? null;

/**
 * Finds the game that decides this bracket.
 *
 * The final is the *terminal* game: the one nothing else advances out of.
 * Deriving it from the graph rather than from `p` matters because placement
 * numbering in a losers bracket is ambiguous - `p: 1` there could reasonably
 * mean "best of the rest" rather than "last overall", and picking the wrong
 * game would hand the sacko to the wrong member.
 *
 * `p === 1` and then the highest round break a tie, so a bracket with several
 * terminal games still resolves deterministically.
 */
function findTitleGame(
  entries: SleeperBracketEntry[],
  direction: AdvancementDirection,
): SleeperBracketEntry | undefined {
  if (entries.length === 0) return undefined;

  const known = new Set(entries.map(entry => entry.m));
  const feedsAnother = new Set<number>();

  for (const entry of entries) {
    for (const from of [entry.t1_from, entry.t2_from]) {
      const source = direction === 'w' ? from?.w : from?.l;
      if (source !== undefined && known.has(source)) feedsAnother.add(source);
    }
  }

  const terminal = entries.filter(entry => !feedsAnother.has(entry.m));

  // Every game feeding another means the links form a cycle. Fall back to the
  // whole bracket rather than returning nothing.
  const candidates = terminal.length > 0 ? terminal : entries;

  return [...candidates].sort(
    (a, b) => Number(b.p === 1) - Number(a.p === 1) || b.r - a.r || a.m - b.m,
  )[0];
}

/**
 * Every game on the path to the bracket's title game, including it.
 *
 * Only the advancing link is followed. In the winners bracket that excludes the
 * third-place game and every other placement game, because a team arrives there
 * by losing. In the sacko bracket the same walk runs the other way.
 */
function collectTitlePath(
  titleGame: SleeperBracketEntry,
  byMatchupId: Map<number, SleeperBracketEntry>,
  direction: AdvancementDirection,
): Set<number> {
  const onPath = new Set<number>();

  const walk = (entry: SleeperBracketEntry) => {
    // Brackets are supposed to be acyclic, but this is external data and a
    // cycle here would hang the sync rather than fail it.
    if (onPath.has(entry.m)) return;
    onPath.add(entry.m);

    for (const from of [entry.t1_from, entry.t2_from]) {
      const source = direction === 'w' ? from?.w : from?.l;
      if (source === undefined) continue;
      const previous = byMatchupId.get(source);
      if (previous) walk(previous);
    }
  };

  walk(titleGame);
  return onPath;
}

/**
 * Turns one Sleeper bracket into games ready to store.
 *
 * Every game is returned, including consolation games. `countsTowardRecord` is
 * the flag that keeps placement games out of records while still letting them
 * appear in a game log.
 */
export function classifyBracket(
  entries: SleeperBracketEntry[],
): ClassifiedBracket {
  const direction = detectAdvancementDirection(entries);
  const byMatchupId = new Map(entries.map(entry => [entry.m, entry]));
  const titleGame = findTitleGame(entries, direction);
  const titlePath = titleGame
    ? collectTitlePath(titleGame, byMatchupId, direction)
    : new Set<number>();

  return {
    direction,
    games: entries.map(entry => ({
      round: entry.r,
      matchupId: entry.m,
      placement: entry.p ?? null,
      isTitleGame: titleGame ? entry.m === titleGame.m : false,
      countsTowardRecord: titlePath.has(entry.m),
      topRosterId: entry.t1 ?? null,
      bottomRosterId: entry.t2 ?? null,
      winningRosterId: entry.w ?? null,
      losingRosterId: entry.l ?? null,
      advancingRosterId: advancingFrom(entry, direction),
    })),
  };
}
