import type { AlertQb } from './alerts';
import { planQbStreamingRefresh } from './refresh';
import { getProjections, getRostership } from '~/libs/sleeper/api.server';
import { getWeekNflGames } from '~/models/nflgame.server';
import { getActivePlayersByPosition } from '~/models/players.server';
import type { QBStreamingWeek } from '~/models/qbstreamingweek.server';
import {
  createQBStreamingWeekOptions,
  getQBStreamingWeekOptionsForSync,
  hideUnpickedQBStreamingWeekOptions,
  restoreQBStreamingWeekOptions,
} from '~/models/qbstreamingweekoption.server';

export type RefreshChanges = {
  added: AlertQb[];
  restored: AlertQb[];
  removed: AlertQb[];
};

type MatchupGame = {
  homeTeamId: string;
  homeTeam: { sleeperId: string };
  awayTeam: { sleeperId: string };
};

/** "NYG vs DAL" for a home QB, "NYG at DAL" for an away one. */
const matchup = (teamId: string | null, game: MatchupGame) =>
  teamId === game.homeTeamId
    ? `${game.homeTeam.sleeperId} vs ${game.awayTeam.sleeperId}`
    : `${game.awayTeam.sleeperId} at ${game.homeTeam.sleeperId}`;

/**
 * Brings a QB Streaming week's options up to date with Sleeper - see
 * planQbStreamingRefresh for the rules - and returns what changed. Shared by
 * the scheduled sync and the admin week page's Import Players button.
 */
export async function refreshQbStreamingWeek(
  qbStreamingWeek: Pick<QBStreamingWeek, 'id' | 'year' | 'week'>,
  {
    now = new Date(),
    games: weekGames,
  }: {
    now?: Date;
    /** The week's games, when the caller has already loaded them. */
    games?: Awaited<ReturnType<typeof getWeekNflGames>>;
  } = {},
): Promise<RefreshChanges> {
  const { id, year, week } = qbStreamingWeek;
  const [games, qbs, rostership, projections, options] = await Promise.all([
    weekGames ?? getWeekNflGames(year, week),
    getActivePlayersByPosition('QB'),
    getRostership(year, week),
    getProjections(year, week),
    getQBStreamingWeekOptionsForSync(id),
  ]);

  const plan = planQbStreamingRefresh({
    qbs,
    rostership,
    projections,
    games,
    options: options.map(option => ({
      id: option.id,
      playerId: option.playerId,
      sleeperId: option.player.sleeperId,
      removedAt: option.removedAt,
      removedBy: option.removedBy,
      keptByAdmin: option.keptByAdmin,
      gameStartTime: option.nflGame.gameStartTime,
      pickCount:
        option._count.StandardQBSelections + option._count.DeepQBSelections,
    })),
    now,
  });

  await createQBStreamingWeekOptions(
    plan.add.map(option => ({ ...option, qbStreamingWeekId: id })),
  );
  await restoreQBStreamingWeekOptions(plan.restore, 'sync');
  const hidden = new Set(await hideUnpickedQBStreamingWeekOptions(plan.remove));

  const qbById = new Map(qbs.map(qb => [qb.id, qb]));
  const gameById = new Map(games.map(game => [game.id, game]));
  const optionAlert = (option: (typeof options)[number]): AlertQb => ({
    fullName: option.player.fullName,
    isDeep: option.isDeep,
    matchup: matchup(option.player.currentNFLTeamId, option.nflGame),
  });

  return {
    added: plan.add.flatMap(({ playerId, isDeep, nflGameId }) => {
      const qb = qbById.get(playerId);
      const game = gameById.get(nflGameId);
      return qb && game
        ? [
            {
              fullName: qb.fullName,
              isDeep,
              matchup: matchup(qb.currentNFLTeamId, game),
            },
          ]
        : [];
    }),
    restored: options
      .filter(option => plan.restore.includes(option.id))
      .map(optionAlert),
    removed: options.filter(option => hidden.has(option.id)).map(optionAlert),
  };
}
