import { prisma } from '~/db.server';
import { assignCompetitionRanks } from '~/utils/rank';

export async function getD12WeekScoresBySeasonYear(year: number) {
  return prisma.d12WeekScore.findMany({
    where: {
      league: {
        season: { year },
      },
    },
    include: {
      league: true,
      user: true,
    },
  });
}

/** The same rows, narrowed to one week, for the weekly leaderboard. */
export async function getD12WeekScoresBySeasonYearAndWeek(
  year: number,
  week: number,
) {
  return prisma.d12WeekScore.findMany({
    where: {
      week,
      league: {
        season: { year },
      },
    },
    include: {
      league: true,
      user: true,
    },
  });
}

/**
 * Latest week with any scoring, which bounds the week picker. Mirrors
 * getNewestWeekTeamGameByYear for the league boards.
 */
export async function getNewestD12WeekByYear(year: number) {
  const result = await prisma.d12WeekScore.aggregate({
    where: {
      league: {
        season: { year },
      },
      points: { gt: 0 },
    },
    _max: { week: true },
  });

  return result._max.week ?? 1;
}

export interface D12LeaderboardEntry {
  userId: string;
  discordName: string;
  discordAvatar: string;
  totalPoints: number;
  bestWeek: number;
  bestWeekPoints: number;
  byLeague: { leagueId: string; leagueName: string; points: number }[];
  rank: number;
}

/**
 * Rolls week scores up per manager, summing across whichever D12 leagues they
 * play in.
 *
 * Pass a whole season's rows for the season board, or a single week's for the
 * weekly board - in that case `totalPoints` is that week's total and `byLeague`
 * is that week's split.
 */
export function computeD12Leaderboard(
  weekScores: Awaited<ReturnType<typeof getD12WeekScoresBySeasonYear>>,
): D12LeaderboardEntry[] {
  const userMap = new Map<
    string,
    {
      discordName: string;
      discordAvatar: string;
      byLeague: Map<string, { leagueName: string; points: number }>;
      byWeek: Map<number, number>;
    }
  >();

  for (const score of weekScores) {
    if (!userMap.has(score.userId)) {
      userMap.set(score.userId, {
        discordName: score.user.discordName,
        discordAvatar: score.user.discordAvatar,
        byLeague: new Map(),
        byWeek: new Map(),
      });
    }
    const entry = userMap.get(score.userId)!;

    const leaguePoints =
      (entry.byLeague.get(score.d12LeagueId)?.points ?? 0) +
      (score.points ?? 0);
    entry.byLeague.set(score.d12LeagueId, {
      leagueName: score.league.name,
      points: leaguePoints,
    });

    const weekTotal = (entry.byWeek.get(score.week) ?? 0) + (score.points ?? 0);
    entry.byWeek.set(score.week, weekTotal);
  }

  const leaderboard: Omit<D12LeaderboardEntry, 'rank'>[] = [];

  for (const [userId, data] of userMap.entries()) {
    const totalPoints = Array.from(data.byLeague.values()).reduce(
      (sum, l) => sum + l.points,
      0,
    );

    let bestWeek = 0;
    let bestWeekPoints = 0;
    for (const [week, pts] of data.byWeek.entries()) {
      if (pts > bestWeekPoints) {
        bestWeekPoints = pts;
        bestWeek = week;
      }
    }

    const byLeague = Array.from(data.byLeague.entries()).map(
      ([leagueId, { leagueName, points }]) => ({
        leagueId,
        leagueName,
        points,
      }),
    );

    leaderboard.push({
      userId,
      discordName: data.discordName,
      discordAvatar: data.discordAvatar,
      totalPoints,
      bestWeek,
      bestWeekPoints,
      byLeague,
    });
  }

  leaderboard.sort((a, b) => b.totalPoints - a.totalPoints);

  return assignCompetitionRanks(leaderboard, entry => entry.totalPoints);
}
