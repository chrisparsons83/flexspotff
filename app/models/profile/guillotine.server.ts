import type { GuillotineLeagueInput } from './guillotineProfile';
import {
  buildGuillotineCareer,
  buildGuillotineSeason,
  winningClaims,
} from './guillotineProfile';
import { prisma } from '~/db.server';
import type { ViewTransaction } from '~/libs/guillotine/views';
import { getPlayersBySleepersIds } from '~/models/players.server';

/**
 * Everything the Guillotine tab shows. Escapes and ranks are measured against
 * every team in each league, so each league the member played in is read
 * whole - at most 18 teams and a few hundred transactions apiece.
 */
export async function getGuillotineProfile(userId: string) {
  const myTeams = await prisma.guillotineTeam.findMany({
    where: { userId },
    select: { rosterId: true, guillotineLeagueId: true },
  });
  if (myTeams.length === 0) return { hasPlayed: false as const };

  const leagueIds = myTeams.map(team => team.guillotineLeagueId);
  const [leagues, transactions, picks] = await Promise.all([
    prisma.guillotineLeague.findMany({
      where: { id: { in: leagueIds } },
      include: {
        season: { select: { year: true } },
        teams: {
          select: {
            rosterId: true,
            choppedWeek: true,
            finish: true,
            waiverBudgetUsed: true,
            weekScores: {
              select: { week: true, points: true, players: true },
            },
          },
        },
      },
    }),
    prisma.guillotineTransaction.findMany({
      where: { guillotineLeagueId: { in: leagueIds }, type: 'waiver' },
    }),
    prisma.guillotineDraftPick.findMany({
      where: { guillotineLeagueId: { in: leagueIds } },
      select: {
        guillotineLeagueId: true,
        rosterId: true,
        pickNo: true,
        round: true,
        sleeperId: true,
      },
    }),
  ]);

  const inputs: GuillotineLeagueInput[] = leagues
    .map(league => {
      const rosterId = myTeams.find(
        team => team.guillotineLeagueId === league.id,
      )!.rosterId;
      const used =
        league.teams.find(team => team.rosterId === rosterId)
          ?.waiverBudgetUsed ?? 0;
      return {
        leagueId: league.id,
        leagueName: league.name,
        year: league.season.year,
        teamCount: league.teams.length,
        isComplete: league.isComplete,
        lastScoredWeek: league.lastScoredWeek,
        rosterId,
        faabLeft: Math.max(0, league.waiverBudget - used),
        teams: league.teams,
        scores: league.teams.flatMap(team =>
          team.weekScores.map(score => ({
            rosterId: team.rosterId,
            ...score,
          })),
        ),
        transactions: transactions.filter(
          t => t.guillotineLeagueId === league.id,
        ) as ViewTransaction[],
        picks: picks
          .filter(
            pick =>
              pick.guillotineLeagueId === league.id &&
              pick.rosterId === rosterId,
          )
          .map(({ pickNo, round, sleeperId }) => ({
            pickNo,
            round,
            sleeperId,
          })),
      };
    })
    .sort(
      (a, b) => b.year - a.year || a.leagueName.localeCompare(b.leagueName),
    );

  const seasons = inputs.map(buildGuillotineSeason);

  // Only finished weeks: the one being played is still moving.
  const myScores = inputs.flatMap(input =>
    input.scores
      .filter(
        score =>
          score.rosterId === input.rosterId &&
          score.week <= input.lastScoredWeek,
      )
      .map(score => ({
        points: score.points,
        week: score.week,
        year: input.year,
        leagueName: input.leagueName,
      })),
  );

  const claims = winningClaims(inputs);
  const sleeperIds = new Set([
    ...claims.map(claim => claim.sleeperId),
    ...seasons.flatMap(season => season.picks.map(pick => pick.sleeperId)),
    ...seasons.flatMap(season =>
      season.biggestClaim ? [season.biggestClaim.sleeperId] : [],
    ),
  ]);
  const players = Object.fromEntries(
    (await getPlayersBySleepersIds([...sleeperIds])).map(player => [
      player.sleeperId,
      {
        name: player.fullName,
        firstName: player.firstName,
        lastName: player.lastName,
        position: player.position,
        nflTeam: player.nflTeam,
      },
    ]),
  );

  return {
    hasPlayed: true as const,
    career: buildGuillotineCareer(seasons, myScores),
    seasons,
    claims,
    players,
  };
}
