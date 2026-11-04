import { DateTime } from 'luxon';
import type {
  SleeperProjectionsJson,
  SleeperRostershipJson,
} from '~/libs/sleeper/schemas';

/** A QB rostered in at least this share of Sleeper leagues is too obvious to stream. */
export const MAX_ROSTERSHIP = 50;
/** Under this share of leagues, a QB is in the deep pool as well as the standard one. */
export const DEEP_ROSTERSHIP = 25;
/** A QB projected at or under this many half-PPR points isn't worth listing. */
export const MIN_PROJECTION = 1;

export type RefreshQb = {
  id: string;
  sleeperId: string;
  currentNFLTeamId: string | null;
};

export type RefreshGame = {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  gameStartTime: Date;
};

export type RefreshOption = {
  id: string;
  playerId: string;
  sleeperId: string;
  removedAt: Date | null;
  gameStartTime: Date;
  pickCount: number;
};

export type RefreshPlan = {
  add: { playerId: string; isDeep: boolean; nflGameId: string }[];
  restore: string[];
  remove: string[];
};

/**
 * What one QB Streaming refresh should change, worked out from Sleeper's
 * rostership and projections. It only ever adds QBs, brings hidden ones back
 * or hides unpicked ones; it never touches an option's pool, so a QB who
 * starts the week in the deep pool stays there however their rostership moves.
 *
 * - Add: an active QB under 50% rostered, projected over 1 point, whose game
 *   hasn't started and who isn't in the week yet. Under 25% rostered puts them
 *   in the deep pool too.
 * - Restore: a hidden QB who qualifies again, or who somebody has picked.
 * - Remove: a listed QB nobody has picked, whose game hasn't started, that
 *   Sleeper projects at exactly 0 - which is what it does for a QB ruled out.
 *   No projection at all is not the same thing, so it doesn't count.
 */
export function planQbStreamingRefresh({
  qbs,
  rostership,
  projections,
  games,
  options,
  now,
}: {
  qbs: RefreshQb[];
  rostership: SleeperRostershipJson;
  projections: SleeperProjectionsJson;
  games: RefreshGame[];
  options: RefreshOption[];
  now: Date;
}): RefreshPlan {
  const gameByTeam = new Map<string, RefreshGame>();
  for (const game of games) {
    gameByTeam.set(game.homeTeamId, game);
    gameByTeam.set(game.awayTeamId, game);
  }

  const qualifying = new Map<string, { isDeep: boolean; nflGameId: string }>();
  for (const qb of qbs) {
    if (!qb.currentNFLTeamId) continue;
    const game = gameByTeam.get(qb.currentNFLTeamId);
    if (!game || game.gameStartTime <= now) continue;

    const owned = rostership[qb.sleeperId]?.owned ?? 0;
    const projected = projections[qb.sleeperId]?.pts_half_ppr ?? 0;
    if (owned >= MAX_ROSTERSHIP || projected <= MIN_PROJECTION) continue;

    qualifying.set(qb.id, {
      isDeep: owned < DEEP_ROSTERSHIP,
      nflGameId: game.id,
    });
  }

  const listed = new Set(options.map(option => option.playerId));
  const add = [...qualifying]
    .filter(([playerId]) => !listed.has(playerId))
    .map(([playerId, { isDeep, nflGameId }]) => ({
      playerId,
      isDeep,
      nflGameId,
    }));

  const restore = options
    .filter(
      option =>
        option.removedAt &&
        (qualifying.has(option.playerId) || option.pickCount > 0),
    )
    .map(option => option.id);

  const remove = options
    .filter(
      option =>
        !option.removedAt &&
        option.pickCount === 0 &&
        option.gameStartTime > now &&
        projections[option.sleeperId]?.pts_half_ppr === 0,
    )
    .map(option => option.id);

  return { add, restore, remove };
}

const EASTERN = 'America/New_York';

/**
 * When a week's QB Streaming opens: 8am Eastern on the Wednesday before its
 * first game, or on the day itself if the first game is on a Wednesday.
 */
export function qbStreamingOpensAt(firstGameStart: Date): Date {
  const kickoff = DateTime.fromJSDate(firstGameStart).setZone(EASTERN);
  return kickoff
    .minus({ days: (kickoff.weekday - 3 + 7) % 7 })
    .set({ hour: 8, minute: 0, second: 0, millisecond: 0 })
    .toJSDate();
}
