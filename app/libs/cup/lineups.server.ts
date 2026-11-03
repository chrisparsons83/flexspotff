import type { RoundTotals, WeekFacts } from './lineups';
import { buildRoundLineups, cupGameTeamIds, roundTotal } from './lineups';
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

/** Loads these teams' weeks, and returns how to read one team's round from them. */
async function loadRoundLineups(
  year: number,
  weeks: number[],
  teamIds: string[],
) {
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
  const planned = await prisma.teamPlannedLineup.findMany({
    where: { week: { in: weeks }, teamId: { in: teamIds } },
    select: { teamId: true, week: true, starters: true, isOptimal: true },
  });
  const sleeperIds = [
    ...new Set([...teamGames, ...planned].flatMap(game => game.starters)),
  ];
  const facts = await getWeekFacts(year, weeks, sleeperIds);
  const now = new Date();

  return (teamId: string, roundWeeks: number[]) =>
    buildRoundLineups(
      {
        teamGames: teamGames.filter(game => game.teamId === teamId),
        planned: planned.filter(lineup => lineup.teamId === teamId),
      },
      roundWeeks,
      facts,
      now,
    );
}

/**
 * Every cup team's total for every round it is in. A team only has a total for
 * rounds it has reached, so a team knocked out early does not cost lineups for
 * the weeks after.
 */
export async function getCupRoundTotals(
  year: number,
  {
    cupGames,
    weeksByRound,
  }: {
    cupGames: ({ round: string } & Parameters<typeof cupGameTeamIds>[0])[];
    weeksByRound: Record<string, number[]>;
  },
): Promise<RoundTotals> {
  const rounds = Object.entries(weeksByRound)
    .map(([round, roundWeeks]) => ({
      round,
      roundWeeks,
      teamIds: cupGames
        .filter(game => game.round === round)
        .flatMap(cupGameTeamIds),
    }))
    .filter(
      ({ roundWeeks, teamIds }) => roundWeeks.length > 0 && teamIds.length > 0,
    );
  if (rounds.length === 0) return {};

  const lineupsFor = await loadRoundLineups(
    year,
    [...new Set(rounds.flatMap(round => round.roundWeeks))],
    [...new Set(rounds.flatMap(round => round.teamIds))],
  );

  const totals: RoundTotals = {};
  for (const { round, roundWeeks, teamIds } of rounds) {
    totals[round] = Object.fromEntries(
      teamIds.map(teamId => [
        teamId,
        roundTotal(lineupsFor(teamId, roundWeeks)),
      ]),
    );
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
  const teamIds = cupGameTeamIds(game);
  const lineupsFor = await loadRoundLineups(game.cup.year, weeks, teamIds);

  return {
    sides: teamIds.map(teamId => {
      const teamWeeks = lineupsFor(teamId, weeks);
      return { teamId, weeks: teamWeeks, total: roundTotal(teamWeeks) };
    }),
  };
}

export type CupGameLineups = NonNullable<
  Awaited<ReturnType<typeof getCupGameLineups>>
>;
