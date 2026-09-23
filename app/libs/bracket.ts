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
 *
 * The one thing about this format that is not self-evident, and that this file
 * exists to get right: **the losers bracket advances the loser**. Sleeper still
 * reports the higher scorer under `l` and the lower scorer under `w`, because
 * `w` means "moves on in this bracket", and in a toilet bowl you move on by
 * losing. Verified against every bracket game in all thirty league-seasons from
 * 2020 to 2025: in the winners bracket `w` is the higher scorer 209 times out of
 * 210, and in the losers bracket it is the *lower* scorer 209 times out of 209.
 *
 * Both brackets therefore read the same way - follow `w` - and the placement
 * markers mirror rather than continue. In a twelve-team league the winners
 * bracket's `p: 1` decides 1st and 2nd; the losers bracket's `p: 1` decides 11th
 * and 12th, `p: 3` decides 9th and 10th, and `p: 5` decides 7th and 8th.
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
  /**
   * Whoever actually outscored the other, in both brackets. That is Sleeper's
   * `w` in the winners bracket and its `l` in the losers bracket - see the note
   * at the top of this file. Storing the sporting result rather than Sleeper's
   * raw field is what lets every reader just ask who won.
   */
  winningRosterId: number | null;
  losingRosterId: number | null;
  /**
   * Who moved on toward this bracket's outcome - the title, or the sacko.
   *
   * This is Sleeper's `w` in both brackets, which is why it is the field worth
   * reading: in the losers bracket `w` is the team that scored *less*, since
   * every defeat there carries you closer to last place.
   */
  advancingRosterId: number | null;
};

export type ClassifiedBracket = {
  games: ClassifiedBracketGame[];
};

/**
 * The game that decides the sacko.
 *
 * It is the losers bracket's `p: 1`, the same marker the winners bracket uses
 * for its final, because the two brackets mirror: `p: 1` is the last game of
 * each, and the last game of the toilet bowl decides last place overall. The
 * sacko is that game's `advancingRosterId` - Sleeper's `w`, the lower scorer.
 *
 * Unlike a title game this has no fallback. A losers bracket with no placement
 * markers at all gives no way to tell which game decides last place, and naming
 * the wrong member the sacko is worse than naming nobody.
 */
function findSackoGame(
  entries: SleeperBracketEntry[],
): SleeperBracketEntry | undefined {
  return entries.find(entry => entry.p === 1);
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
 * Always walked along `w`, in both brackets. In the winners bracket that gives
 * the games a champion had to win; in the losers bracket the same links give
 * the defeats that carried someone to the sacko, because that is the direction
 * Sleeper advances a toilet bowl. Either way the third- and fifth-place games
 * drop out, which is the point: a team arrives at those by leaving the path.
 */
function collectPath(
  from: SleeperBracketEntry,
  byMatchupId: Map<number, SleeperBracketEntry>,
): Set<number> {
  const onPath = new Set<number>();

  const walk = (entry: SleeperBracketEntry) => {
    // Brackets are supposed to be acyclic, but this is external data and a
    // cycle here would hang the sync rather than fail it.
    if (onPath.has(entry.m)) return;
    onPath.add(entry.m);

    for (const link of [entry.t1_from, entry.t2_from]) {
      const source = link?.w;
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
 * Both brackets are read the same way, along `w`. What differs is only which
 * game ends them and what a `w` means on the scoreboard - see the note at the
 * top of this file. An earlier version of this file walked the losers bracket
 * backwards along `l` and took the sacko from the highest placement marker;
 * against real Sleeper data that names the wrong member in every league.
 */
export function classifyBracket(
  entries: SleeperBracketEntry[],
  bracket: BracketKind,
): ClassifiedBracket {
  const isWinners = bracket === 'WINNERS';

  const byMatchupId = new Map(entries.map(entry => [entry.m, entry]));
  const decidingGame = isWinners
    ? findTitleGame(entries)
    : findSackoGame(entries);

  const path = decidingGame
    ? collectPath(decidingGame, byMatchupId)
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
      // Sleeper's `w` is whoever moved on, not whoever scored more. They are
      // the same team in the winners bracket and opposites in the losers one.
      winningRosterId: (isWinners ? entry.w : entry.l) ?? null,
      losingRosterId: (isWinners ? entry.l : entry.w) ?? null,
      advancingRosterId: entry.w ?? null,
    })),
  };
}

/**
 * The two places one placement game decides, keyed to Sleeper's `w` and `l`.
 *
 * The brackets mirror. A winners `p: N` seats its advancing team Nth and the
 * other N+1. A losers `p: N` counts from the bottom instead, so in a twelve-team
 * league `p: 1` seats its advancing team 12th - and since that team is the one
 * Sleeper records under `w`, the sacko really is the "winner" of the toilet
 * bowl's final.
 *
 * Deliberately independent of how many teams made the playoffs: the placement
 * markers already encode that, and a league that changes its playoff size does
 * not change how Sleeper numbers them.
 */
export function placesForPlacementGame({
  bracket,
  placement,
  teamCount,
}: {
  bracket: BracketKind;
  placement: number;
  teamCount: number;
}): { advancingPlace: number; otherPlace: number } | null {
  if (!Number.isInteger(placement) || placement < 1) return null;
  if (!Number.isInteger(teamCount) || teamCount < 2) return null;

  const places =
    bracket === 'WINNERS'
      ? { advancingPlace: placement, otherPlace: placement + 1 }
      : {
          advancingPlace: teamCount - placement + 1,
          otherPlace: teamCount - placement,
        };

  const inRange = (place: number) => place >= 1 && place <= teamCount;
  if (!inRange(places.advancingPlace) || !inRange(places.otherPlace)) {
    return null;
  }

  return places;
}

function ordinal(value: number): string {
  // 11th, 12th and 13th break the usual pattern, and they are exactly the
  // places a twelve-team league lands on most often.
  const teens = value % 100;
  if (teens >= 11 && teens <= 13) return `${value}th`;

  const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[value % 10] ?? 'th';
  return `${value}${suffix}`;
}

/**
 * What to call a finishing place.
 *
 * The extremes are checked before the middle so that a small league, where the
 * sacko places could overlap the semifinal ones, still reads sensibly. Places
 * between the quarterfinals and the sacko final get a plain ordinal, because
 * there is no name for finishing ninth.
 */
export function finishLabelForPlace(place: number, teamCount: number): string {
  if (place === 1) return 'Champion';
  if (place === 2) return 'Runner Up';
  if (place === teamCount) return 'Sacko';
  if (place === teamCount - 1) return 'Sacko Finalist';
  if (place === 3 || place === 4) return 'Semifinalist';
  if (place === 5 || place === 6) return 'Quarterfinalist';
  return ordinal(place);
}
