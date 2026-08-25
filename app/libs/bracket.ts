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

export type ClassifiedBracketGame = {
  round: number;
  matchupId: number;
  placement: number | null;
  /** Decides this bracket's title. */
  isTitleGame: boolean;
  /** On the path to the title, so it counts toward a playoff record. */
  countsTowardRecord: boolean;
  topRosterId: number | null;
  bottomRosterId: number | null;
  winningRosterId: number | null;
  losingRosterId: number | null;
};

/**
 * Finds the game that decides the bracket's title.
 *
 * `p === 1` is the direct answer. Some brackets omit `p` entirely, so the
 * fallback is the last round - and if that round somehow holds several games,
 * the lowest `m`, purely so the choice is deterministic rather than dependent on
 * array order.
 */
function findTitleGame(
  entries: SleeperBracketEntry[],
): SleeperBracketEntry | undefined {
  const flagged = entries.find(entry => entry.p === 1);
  if (flagged) return flagged;

  if (entries.length === 0) return undefined;

  const lastRound = Math.max(...entries.map(entry => entry.r));
  return entries
    .filter(entry => entry.r === lastRound)
    .sort((a, b) => a.m - b.m)[0];
}

/**
 * Every game a team had to win to reach the title game, including the title
 * game itself.
 *
 * Only the `w` links are followed. Arriving somewhere by losing is what a
 * consolation bracket is, so following `l` would pull the third-place game and
 * the rest of the placement games back in - exactly what this exists to exclude.
 */
function collectTitlePath(
  titleGame: SleeperBracketEntry,
  byMatchupId: Map<number, SleeperBracketEntry>,
): Set<number> {
  const onPath = new Set<number>();

  const walk = (entry: SleeperBracketEntry) => {
    // Brackets are supposed to be acyclic, but this is external data and a
    // cycle here would hang the sync rather than fail it.
    if (onPath.has(entry.m)) return;
    onPath.add(entry.m);

    for (const from of [entry.t1_from, entry.t2_from]) {
      if (from?.w === undefined) continue;
      const previous = byMatchupId.get(from.w);
      if (previous) walk(previous);
    }
  };

  walk(titleGame);
  return onPath;
}

/**
 * Turns one Sleeper bracket into games ready to store, marking which of them
 * count toward a playoff record.
 *
 * Every game is returned, including consolation games. `countsTowardRecord`
 * is the flag that keeps third-place and other placement games out of records
 * while still letting them appear in a game log.
 */
export function classifyBracket(
  entries: SleeperBracketEntry[],
): ClassifiedBracketGame[] {
  const byMatchupId = new Map(entries.map(entry => [entry.m, entry]));
  const titleGame = findTitleGame(entries);
  const titlePath = titleGame
    ? collectTitlePath(titleGame, byMatchupId)
    : new Set<number>();

  return entries.map(entry => ({
    round: entry.r,
    matchupId: entry.m,
    placement: entry.p ?? null,
    isTitleGame: titleGame ? entry.m === titleGame.m : false,
    countsTowardRecord: titlePath.has(entry.m),
    topRosterId: entry.t1 ?? null,
    bottomRosterId: entry.t2 ?? null,
    winningRosterId: entry.w ?? null,
    losingRosterId: entry.l ?? null,
  }));
}
