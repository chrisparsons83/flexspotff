import type { BracketType } from '@prisma/client';
import { prisma } from '~/db.server';

export type { PlayoffGame } from '@prisma/client';

export type PlayoffGameUpsert = {
  leagueId: string;
  bracket: BracketType;
  round: number;
  matchupId: number;
  placement: number | null;
  isTitleGame: boolean;
  countsTowardRecord: boolean;
  topTeamId: string | null;
  bottomTeamId: string | null;
  winningTeamId: string | null;
  losingTeamId: string | null;
  advancingTeamId: string | null;
};

/**
 * Writes one bracket game, keyed by its position in the bracket rather than by
 * id, so re-syncing a league as its playoffs progress fills in results instead
 * of duplicating games.
 */
export async function upsertPlayoffGame(game: PlayoffGameUpsert) {
  const { leagueId, bracket, matchupId, ...rest } = game;

  return prisma.playoffGame.upsert({
    where: {
      leagueId_bracket_matchupId: { leagueId, bracket, matchupId },
    },
    update: rest,
    create: game,
  });
}

const PLAYOFF_TEAM = { include: { user: true } } as const;

/**
 * A league's playoff games in both brackets, round by round, with the teams
 * and their managers.
 */
export async function getPlayoffGamesByLeague(leagueId: string) {
  return prisma.playoffGame.findMany({
    where: { leagueId },
    orderBy: [{ bracket: 'asc' }, { round: 'asc' }, { matchupId: 'asc' }],
    include: {
      topTeam: PLAYOFF_TEAM,
      bottomTeam: PLAYOFF_TEAM,
      winningTeam: PLAYOFF_TEAM,
    },
  });
}

export async function countPlayoffGamesByLeague(leagueId: string) {
  return prisma.playoffGame.count({ where: { leagueId } });
}
