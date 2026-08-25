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

export type BracketKind = 'WINNERS' | 'LOSERS';

export type ClassifiedBracketGame = {
  round: number;
  matchupId: number;
  placement: number | null;
  /** Decides the outcome this bracket exists to decide: the title, or the sacko. */
  isTitleGame: boolean;
  /** On the path to that outcome, so it counts toward this bracket's record. */
  countsTowardRecord: boolean;
  topRosterId: number | null;
  bottomRosterId: number | null;
  winningRosterId: number | null;
  losingRosterId: number | null;
  /**
   * Who moved on toward this bracket's outcome. In the winners bracket that is
   * whoever won; in the losers bracket it is whoever lost, because there every
   * defeat carries you closer to last place.
   */
  advancingRosterId: number | null;
};

export type ClassifiedBracket = {
  games: ClassifiedBracketGame[];
};

/**
 * Sleeper's placement marker: the winner of a `p: N` game finishes Nth and the
 * loser finishes N+1. Numbering restarts per bracket, so in a twelve-team league
 * with six playoff spots the winners bracket's `p: 1` is first overall while the
 * losers bracket's `p: 1` is *seventh* - the best of the teams who missed out.
 *
 * That is the trap this file exists to avoid. The sacko is not the winner of
 * anything: it is the loser of the losers bracket's **highest** `p`, the game
 * that decides the bottom two places.
 */

/** The game whose loser finishes last in this bracket. */
function findSackoGame(
  entries: SleeperBracketEntry[],
): SleeperBracketEntry | undefined {
  const placementGames = entries.filter(entry => typeof entry.p === 'number');
  if (placementGames.length === 0) return undefined;

  return placementGames.reduce((lowest, entry) =>
    entry.p! > lowest.p! ? entry : lowest,
  );
}

/** The game whose winner takes the title. */
function findTitleGame(
  entries: SleeperBracketEntry[],
): SleeperBracketEntry | undefined {
  if (entries.length === 0) return undefined;

  const flagged = entries.find(entry => entry.p === 1);
  if (flagged) return flagged;

  // A bracket still in progress may carry no placement markers yet. The final
  // is then the game nothing else advances out of.
  const known = new Set(entries.map(entry => entry.m));
  const feedsAnother = new Set<number>();
  for (const entry of entries) {
    for (const from of [entry.t1_from, entry.t2_from]) {
      if (from?.w !== undefined && known.has(from.w)) feedsAnother.add(from.w);
    }
  }

  const terminal = entries.filter(entry => !feedsAnother.has(entry.m));
  const candidates = terminal.length > 0 ? terminal : entries;

  return [...candidates].sort((a, b) => b.r - a.r || a.m - b.m)[0];
}

/**
 * Every game on the path to this bracket's outcome, including the game itself.
 *
 * Which link is followed is what separates the two brackets. Walking `w` back
 * from the final gives the games a champion had to win, and leaves out the
 * third- and fifth-place games because a team reaches those by losing. Walking
 * `l` back from the last-place game gives the mirror image: the defeats that
 * carried someone to the sacko.
 */
function collectPath(
  from: SleeperBracketEntry,
  byMatchupId: Map<number, SleeperBracketEntry>,
  direction: 'w' | 'l',
): Set<number> {
  const onPath = new Set<number>();

  const walk = (entry: SleeperBracketEntry) => {
    // Brackets are supposed to be acyclic, but this is external data and a
    // cycle here would hang the sync rather than fail it.
    if (onPath.has(entry.m)) return;
    onPath.add(entry.m);

    for (const link of [entry.t1_from, entry.t2_from]) {
      const source = direction === 'w' ? link?.w : link?.l;
      if (source === undefined) continue;
      const previous = byMatchupId.get(source);
      if (previous) walk(previous);
    }
  };

  walk(from);
  return onPath;
}

/**
 * Turns one Sleeper bracket into games ready to store.
 *
 * Every game is returned, consolation games included, so a profile can show the
 * full postseason. `countsTowardRecord` is what keeps placement games out of the
 * records themselves.
 *
 * The two brackets are read in opposite directions on purpose - see
 * `findSackoGame`. An earlier attempt inferred the direction by counting `w`
 * versus `l` links; against real data those counts tie exactly, because a
 * Sleeper bracket splits both ways in every round. The placement markers are
 * the only reliable signal.
 */
export function classifyBracket(
  entries: SleeperBracketEntry[],
  bracket: BracketKind,
): ClassifiedBracket {
  const isWinners = bracket === 'WINNERS';
  const direction: 'w' | 'l' = isWinners ? 'w' : 'l';

  const byMatchupId = new Map(entries.map(entry => [entry.m, entry]));
  const decidingGame = isWinners
    ? findTitleGame(entries)
    : findSackoGame(entries);

  // With no placement markers there is no way to tell which losers-bracket game
  // decides last place, and crediting the wrong member is worse than crediting
  // nobody.
  const path = decidingGame
    ? collectPath(decidingGame, byMatchupId, direction)
    : new Set<number>();

  return {
    games: entries.map(entry => ({
      round: entry.r,
      matchupId: entry.m,
      placement: entry.p ?? null,
      isTitleGame: decidingGame ? entry.m === decidingGame.m : false,
      countsTowardRecord: path.has(entry.m),
      topRosterId: entry.t1 ?? null,
      bottomRosterId: entry.t2 ?? null,
      winningRosterId: entry.w ?? null,
      losingRosterId: entry.l ?? null,
      advancingRosterId: (direction === 'w' ? entry.w : entry.l) ?? null,
    })),
  };
}
