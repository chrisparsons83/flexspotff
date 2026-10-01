import { buildBestBallCareer, buildBestBallSeason } from './bestBallProfile';
import { prisma } from '~/db.server';

/**
 * Everything the Best Ball tab shows. Places and the league's average draft
 * are measured against every team, so each league the member played in is
 * read whole - twelve teams and 216 picks apiece.
 */
export async function getBestBallProfile(userId: string) {
  const myTeams = await prisma.bestBallTeam.findMany({
    where: { userId },
    select: { rosterId: true, bestBallLeagueId: true },
  });
  if (myTeams.length === 0) return { hasPlayed: false as const };

  const leagues = await prisma.bestBallLeague.findMany({
    where: { id: { in: myTeams.map(team => team.bestBallLeagueId) } },
    include: {
      season: { select: { year: true } },
      teams: {
        select: {
          id: true,
          rosterId: true,
          pointsFor: true,
          finish: true,
          draftSlot: true,
          weekScores: { select: { week: true, points: true } },
        },
      },
      draftPicks: {
        select: {
          pickNo: true,
          round: true,
          rosterId: true,
          sleeperId: true,
          position: true,
          playerName: true,
          nflTeam: true,
        },
      },
    },
  });

  const seasons = leagues
    .map(league =>
      buildBestBallSeason({
        year: league.season.year,
        leagueName: league.name,
        isComplete: league.isComplete,
        rosterId: myTeams.find(t => t.bestBallLeagueId === league.id)!.rosterId,
        teams: league.teams,
        picks: league.draftPicks,
      }),
    )
    .sort((a, b) => b.year - a.year);

  // Every week they have a score for, to average points a week.
  const weeksPlayed = leagues.reduce((sum, league) => {
    const rosterId = myTeams.find(
      t => t.bestBallLeagueId === league.id,
    )!.rosterId;
    const team = league.teams.find(t => t.rosterId === rosterId);
    return sum + (team?.weekScores.length ?? 0);
  }, 0);

  return {
    hasPlayed: true as const,
    career: buildBestBallCareer(seasons, weeksPlayed),
    seasons,
  };
}
