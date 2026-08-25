import type { BracketType, PlayoffGame } from '@prisma/client';
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

export async function getPlayoffGamesByLeague(leagueId: PlayoffGame['id']) {
  return prisma.playoffGame.findMany({
    where: { leagueId },
    orderBy: [{ bracket: 'asc' }, { round: 'asc' }, { matchupId: 'asc' }],
  });
}

/**
 * Every postseason game a member played, across every season, with enough
 * league context to label it.
 */
export async function getPlayoffGamesByUser(userId: string) {
  return prisma.playoffGame.findMany({
    where: {
      OR: [{ topTeam: { userId } }, { bottomTeam: { userId } }],
    },
    include: {
      league: { select: { year: true, name: true, tier: true } },
      topTeam: { select: { id: true, userId: true } },
      bottomTeam: { select: { id: true, userId: true } },
    },
    orderBy: [{ round: 'asc' }, { matchupId: 'asc' }],
  });
}

/**
 * Every bracket game that has a result, for the record book aggregations.
 */
export async function getDecidedPlayoffGames() {
  return prisma.playoffGame.findMany({
    where: { winningTeamId: { not: null } },
    include: {
      league: { select: { year: true, name: true } },
      topTeam: {
        select: { userId: true, user: { select: { discordName: true } } },
      },
      bottomTeam: {
        select: { userId: true, user: { select: { discordName: true } } },
      },
      winningTeam: {
        select: { userId: true, user: { select: { discordName: true } } },
      },
    },
  });
}
