import type { RoundTotal, WeekFacts, WeekLineup } from './lineups';
import { buildWeekLineup, roundTotal, roundTotalKey } from './lineups';
import { prisma } from '~/db.server';
import type { GameState } from '~/libs/guillotine/projection';
import { getPlayersBySleepersIds } from '~/models/players.server';

/** Everything needed to read lineups for these weeks, by week. */
async function getWeekFacts(
  year: number,
  weeks: number[],
  sleeperIds: string[],
): Promise<Map<number, WeekFacts>> {
  const [players, games] = await Promise.all([
    getPlayersBySleepersIds(sleeperIds),
    prisma.nFLGame.findMany({
      where: { year, week: { in: weeks } },
      select: {
        week: true,
        status: true,
        gameStartTime: true,
        homeTeam: { select: { sleeperId: true } },
        awayTeam: { select: { sleeperId: true } },
      },
    }),
  ]);
  const projections = await prisma.playerWeekScore.findMany({
    where: {
      year,
      week: { in: weeks },
      projection: { not: null },
      playerId: { in: players.map(player => player.id) },
    },
    select: { week: true, playerId: true, projection: true },
  });

  const playerBySleeperId: WeekFacts['playerBySleeperId'] = new Map(
    players.map(player => [player.sleeperId, player]),
  );
  const facts = new Map<number, WeekFacts>(
    weeks.map(week => [
      week,
      {
        playerBySleeperId,
        projectionByPlayerId: new Map(),
        gameByNflTeam: new Map(),
      },
    ]),
  );
  for (const { week, playerId, projection } of projections) {
    facts.get(week)?.projectionByPlayerId.set(playerId, projection!);
  }
  for (const game of games) {
    const entry = {
      state: game.status as GameState,
      kickoff: game.gameStartTime,
    };
    const { gameByNflTeam } = facts.get(game.week)!;
    gameByNflTeam.set(game.homeTeam.sleeperId, entry);
    gameByNflTeam.set(game.awayTeam.sleeperId, entry);
  }
  return facts;
}

async function getLineups(year: number, weeks: number[], teamIds: string[]) {
  const teamGames = await prisma.teamGame.findMany({
    where: { week: { in: weeks }, teamId: { in: teamIds } },
    select: {
      teamId: true,
      week: true,
      pointsScored: true,
      starters: true,
      startingPlayerPoints: true,
    },
    orderBy: { week: 'asc' },
  });
  const sleeperIds = [...new Set(teamGames.flatMap(game => game.starters))];
  const facts = await getWeekFacts(year, weeks, sleeperIds);
  const now = new Date();

  return teamGames.map(game => ({
    teamId: game.teamId,
    lineup: buildWeekLineup(game, facts.get(game.week)!, now),
  }));
}

/**
 * Every cup team's total for every round it is in, keyed by roundTotalKey. A
 * team only has a total for rounds it has reached, so a team knocked out early
 * does not cost lineups for the weeks after.
 */
export async function getCupRoundTotals(
  year: number,
  rounds: { round: string; weeks: number[]; teamIds: string[] }[],
): Promise<Record<string, RoundTotal>> {
  const active = rounds.filter(
    ({ weeks, teamIds }) => weeks.length > 0 && teamIds.length > 0,
  );
  const weeks = [...new Set(active.flatMap(round => round.weeks))];
  const teamIds = [...new Set(active.flatMap(round => round.teamIds))];
  if (weeks.length === 0) return {};

  const byTeamAndWeek = new Map<string, WeekLineup>();
  for (const { teamId, lineup } of await getLineups(year, weeks, teamIds)) {
    byTeamAndWeek.set(`${teamId}:${lineup.week}`, lineup);
  }

  const totals: Record<string, RoundTotal> = {};
  for (const round of active) {
    for (const teamId of round.teamIds) {
      const lineups = round.weeks.flatMap(week => {
        const lineup = byTeamAndWeek.get(`${teamId}:${week}`);
        return lineup ? [lineup] : [];
      });
      totals[roundTotalKey(round.round, teamId)] = roundTotal(
        lineups,
        round.weeks.length,
      );
    }
  }
  return totals;
}

/**
 * Both sides of one cup game: their lineups for each week of the round, and
 * their totals for it. Null for a game that does not exist.
 */
export async function getCupGameLineups(gameId: string) {
  const game = await prisma.cupGame.findUnique({
    where: { id: gameId },
    select: {
      round: true,
      topTeam: { select: { teamId: true } },
      bottomTeam: { select: { teamId: true } },
      cup: {
        select: {
          year: true,
          cupWeeks: { select: { week: true, mapping: true } },
        },
      },
    },
  });
  if (!game) return null;

  const weeks = game.cup.cupWeeks
    .filter(cupWeek => cupWeek.mapping === game.round)
    .map(cupWeek => cupWeek.week)
    .sort((a, b) => a - b);
  const teamIds = [game.topTeam?.teamId, game.bottomTeam?.teamId].filter(
    (teamId): teamId is string => !!teamId,
  );
  const lineups = await getLineups(game.cup.year, weeks, teamIds);

  return {
    sides: teamIds.map(teamId => {
      const teamWeeks = lineups
        .filter(entry => entry.teamId === teamId)
        .map(entry => entry.lineup);
      return {
        teamId,
        weeks: teamWeeks,
        total: roundTotal(teamWeeks, weeks.length),
      };
    }),
  };
}

export type CupGameLineups = NonNullable<
  Awaited<ReturnType<typeof getCupGameLineups>>
>;
