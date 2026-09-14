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
    // Ordered so the breakdown rows under an expanded manager fall in a stable
    // order when two of their teams are tied on points. computeD12Leaderboard
    // breaks the same tie the same way, so the two agree.
    orderBy: [{ league: { name: 'asc' } }, { week: 'asc' }],
  });
}

/**
 * The same rows, narrowed to one week, for the weekly leaderboard. This is the
 * caller that reads the lineup columns: with one week per league the best-ball
 * lineup behind the score is well defined, so the board can show it.
 */
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
    orderBy: { league: { name: 'asc' } },
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

/**
 * The row shape the leaderboard needs, described structurally rather than off
 * one query's return type, so both the season and weekly queries satisfy it -
 * and so a test can build a row without the lineup columns.
 */
export type D12WeekScoreRow = {
  userId: string;
  week: number;
  points: number | null;
  d12LeagueId: string;
  league: { name: string };
  user: { discordName: string; discordAvatar: string };
  starters?: string[];
  startingPlayerPoints?: number[];
};

export type D12LeagueTotal = {
  leagueId: string;
  leagueName: string;
  points: number;
  /** How many weeks went into `points`. */
  weekCount: number;
  /**
   * The best-ball lineup behind `points`, populated only when a single week went
   * into it - a lineup summed across weeks would mean nothing. Empty otherwise.
   */
  starters: string[];
  startingPlayerPoints: number[];
};

export interface D12LeaderboardEntry {
  userId: string;
  discordName: string;
  discordAvatar: string;
  totalPoints: number;
  bestWeek: number;
  bestWeekPoints: number;
  /**
   * Name of the manager's highest-scoring team, or '' when no team of theirs
   * scored above zero - matching how bestWeek is left at 0.
   */
  bestLeagueName: string;
  bestLeaguePoints: number;
  byLeague: D12LeagueTotal[];
  rank: number;
}

/**
 * Rolls week scores up per manager, summing across whichever D12 leagues they
 * play in.
 *
 * Pass a whole season's rows for the season board, or a single week's for the
 * weekly board - in that case `totalPoints` is that week's total, `byLeague` is
 * that week's split, and `bestLeague*` is their best team that week.
 */
export function computeD12Leaderboard(
  weekScores: D12WeekScoreRow[],
): D12LeaderboardEntry[] {
  const userMap = new Map<
    string,
    {
      discordName: string;
      discordAvatar: string;
      byLeague: Map<string, Omit<D12LeagueTotal, 'leagueId'>>;
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

    const existing = entry.byLeague.get(score.d12LeagueId);
    const weekCount = (existing?.weekCount ?? 0) + 1;
    entry.byLeague.set(score.d12LeagueId, {
      leagueName: score.league.name,
      points: (existing?.points ?? 0) + (score.points ?? 0),
      weekCount,
      // Only meaningful for a single week, which is the weekly board's case.
      starters: weekCount === 1 ? score.starters ?? [] : [],
      startingPlayerPoints:
        weekCount === 1 ? score.startingPlayerPoints ?? [] : [],
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

    // Their single highest-scoring team, as opposed to bestWeek above, which is
    // their best week summed across every team. Left blank on a manager with
    // nothing but zeroes, the same way bestWeek is.
    let bestLeagueName = '';
    let bestLeaguePoints = 0;
    for (const { leagueName, points } of data.byLeague.values()) {
      // Ties break on league name rather than on whichever row arrived first,
      // so the pick holds whether or not the caller ordered its query.
      const beatsBest =
        points > bestLeaguePoints ||
        (points === bestLeaguePoints &&
          bestLeagueName !== '' &&
          leagueName < bestLeagueName);
      if (beatsBest) {
        bestLeaguePoints = points;
        bestLeagueName = leagueName;
      }
    }

    const byLeague = Array.from(data.byLeague.entries()).map(
      ([leagueId, total]) => ({ leagueId, ...total }),
    );

    leaderboard.push({
      userId,
      discordName: data.discordName,
      discordAvatar: data.discordAvatar,
      totalPoints,
      bestWeek,
      bestWeekPoints,
      bestLeagueName,
      bestLeaguePoints,
      byLeague,
    });
  }

  leaderboard.sort((a, b) => b.totalPoints - a.totalPoints);

  return assignCompetitionRanks(leaderboard, entry => entry.totalPoints);
}
