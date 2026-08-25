import {
  aggregatePlayoffStats,
  computeStreak,
  pairTeamGames,
  winPct,
} from './shared.server';
import { prisma } from '~/db.server';

/**
 * The profile hero: who this is, their career headline numbers, and their
 * badges.
 *
 * This is the one query that runs on every tab, so it is deliberately the
 * narrowest of the profile aggregations - counts and sums, no game logs. If
 * profiles ever need caching, this is the function to cache.
 */

/** A 200 point week is rare enough to be worth calling out. */
const BIG_WEEK_POINTS = 200;

/** Long enough to be a run rather than a hot fortnight. */
const NOTABLE_STREAK = 6;

/** Playing this many different contests makes someone a regular everywhere. */
const MULTI_SPORT_CONTESTS = 4;

export type Badge = {
  key: string;
  label: string;
  emoji: string;
  count?: number;
  description: string;
};

export type ProfileSummary = {
  user: {
    id: string;
    discordName: string;
    discordAvatar: string;
    memberSince: Date;
  };
  currentTeam: { year: number; leagueName: string; tier: number } | null;
  headline: { label: string; value: string }[];
  badges: Badge[];
  /** Which tabs have anything in them, so the tab bar can show it. */
  contestsPlayed: string[];
};

export async function getProfileSummary(
  userId: string,
): Promise<ProfileSummary | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      discordName: true,
      discordAvatar: true,
      createdAt: true,
    },
  });

  if (!user) return null;

  const [
    teams,
    playoffGames,
    cupFinalWins,
    cupSeasons,
    bigWeeks,
    episodeCount,
    d12Count,
    qbCount,
    poolCount,
    locksCount,
    dfsCount,
    fSquaredCount,
    omniCount,
  ] = await Promise.all([
    prisma.team.findMany({
      where: { userId },
      select: {
        wins: true,
        losses: true,
        ties: true,
        medianWins: true,
        medianLosses: true,
        medianTies: true,
        pointsFor: true,
        league: { select: { year: true, name: true, tier: true } },
      },
    }),
    prisma.playoffGame.findMany({
      where: { league: { teams: { some: { userId } } } },
      include: {
        topTeam: { select: { userId: true } },
        bottomTeam: { select: { userId: true } },
        winningTeam: { select: { userId: true } },
      },
    }),
    prisma.cupGame.count({
      where: { round: 'ROUND_OF_2', winningTeam: { team: { userId } } },
    }),
    prisma.cupTeam.count({ where: { team: { userId } } }),
    prisma.teamGame.count({
      where: { team: { userId }, pointsScored: { gte: BIG_WEEK_POINTS } },
    }),
    prisma.episode.count({ where: { authorId: userId } }),
    prisma.d12WeekScore.count({ where: { userId } }),
    prisma.qBSelection.count({ where: { userId } }),
    prisma.poolGamePick.count({ where: { userId } }),
    prisma.locksGamePick.count({ where: { userId } }),
    prisma.dFSSurvivorUserYear.count({ where: { userId } }),
    prisma.fSquaredEntry.count({ where: { userId } }),
    prisma.omniUserTeam.count({ where: { userId } }),
  ]);

  const career = teams.reduce(
    (acc, team) => ({
      wins: acc.wins + team.wins,
      losses: acc.losses + team.losses,
      ties: acc.ties + team.ties,
      pointsFor: acc.pointsFor + team.pointsFor,
    }),
    { wins: 0, losses: 0, ties: 0, pointsFor: 0 },
  );

  const playoffs = aggregatePlayoffStats(playoffGames).get(userId);
  const championships = playoffs?.championships ?? 0;
  const toiletBowls = playoffs?.toiletBowls ?? 0;

  const seasons = [...teams].sort((a, b) => b.league.year - a.league.year);
  const latest = seasons[0] ?? null;
  const championsSeasons = teams.filter(team => team.league.tier === 1).length;

  // The tiers are ordered so that 1 is the top league; moving to a lower number
  // is a promotion.
  const chronological = [...teams].sort(
    (a, b) => a.league.year - b.league.year,
  );
  const promotions = chronological.reduce(
    (count, team, index) =>
      index > 0 && team.league.tier < chronological[index - 1].league.tier
        ? count + 1
        : count,
    0,
  );

  const contestsPlayed = [
    teams.length > 0 && 'league',
    cupSeasons > 0 && 'cup',
    d12Count > 0 && 'd12',
    qbCount > 0 && 'qb-streaming',
    poolCount > 0 && 'spread-pool',
    locksCount > 0 && 'locks',
    dfsCount > 0 && 'dfs-survivor',
    fSquaredCount > 0 && 'f-squared',
    omniCount > 0 && 'omni',
  ].filter((value): value is string => typeof value === 'string');

  const badges: Badge[] = [];
  const add = (badge: Badge) => badges.push(badge);

  if (championships > 0) {
    add({
      key: 'league-champion',
      label: 'League Champion',
      emoji: '🏆',
      count: championships,
      description: 'Won a league championship',
    });
  }
  if (cupFinalWins > 0) {
    add({
      key: 'cup-champion',
      label: 'Cup Champion',
      emoji: '🥇',
      count: cupFinalWins,
      description: 'Won the Cup',
    });
  }
  if (championsSeasons > 0) {
    add({
      key: 'champions-league',
      label: 'Champions League',
      emoji: '👑',
      count: championsSeasons,
      description: 'Played a season in the top tier',
    });
  }
  if (promotions > 0) {
    add({
      key: 'climber',
      label: 'Climber',
      emoji: '📈',
      count: promotions,
      description: 'Promoted to a higher tier',
    });
  }
  if (toiletBowls > 0) {
    add({
      key: 'toilet-bowl',
      label: 'Toilet Bowl',
      emoji: '🚽',
      count: toiletBowls,
      description: 'Won the losers bracket',
    });
  }
  if (bigWeeks > 0) {
    add({
      key: 'big-week',
      label: `${BIG_WEEK_POINTS}+ Point Week`,
      emoji: '💥',
      count: bigWeeks,
      description: `Scored ${BIG_WEEK_POINTS} or more in a week`,
    });
  }
  if (teams.length > 0) {
    add({
      key: 'seasons',
      label: 'Seasons Played',
      emoji: '📅',
      count: teams.length,
      description: 'Seasons in the redraft league',
    });
  }
  if (episodeCount > 0) {
    add({
      key: 'podcast',
      label: 'Podcast Host',
      emoji: '🎙️',
      count: episodeCount,
      description: 'Recorded podcast episodes',
    });
  }
  if (contestsPlayed.length >= MULTI_SPORT_CONTESTS) {
    add({
      key: 'multi-sport',
      label: 'Multi-Sport',
      emoji: '🎲',
      count: contestsPlayed.length,
      description: 'Played across many different contests',
    });
  }

  const longestStreak = await getLongestWinStreak(userId);
  if (longestStreak >= NOTABLE_STREAK) {
    add({
      key: 'streak',
      label: 'Win Streak',
      emoji: '🔥',
      count: longestStreak,
      description: 'Longest run of consecutive wins',
    });
  }

  return {
    user: {
      id: user.id,
      discordName: user.discordName,
      discordAvatar: user.discordAvatar,
      memberSince: user.createdAt,
    },
    currentTeam: latest
      ? {
          year: latest.league.year,
          leagueName: latest.league.name,
          tier: latest.league.tier,
        }
      : null,
    headline: [
      { label: 'Seasons', value: teams.length.toString() },
      {
        label: 'Career Record',
        value: `${career.wins}-${career.losses}-${career.ties}`,
      },
      { label: 'Win %', value: winPct(career).toFixed(3).replace(/^0/, '') },
      { label: 'Points For', value: Math.round(career.pointsFor).toString() },
      { label: 'Titles', value: championships.toString() },
    ],
    badges,
    contestsPlayed,
  };
}

/**
 * The member's longest run of consecutive wins.
 *
 * Every game in the leagues they played is fetched, not just their own, because
 * a result only exists once both sides of a matchup are known - that is what
 * pairTeamGames needs.
 */
async function getLongestWinStreak(userId: string): Promise<number> {
  const leagueIds = (
    await prisma.team.findMany({
      where: { userId },
      select: { leagueId: true },
    })
  ).map(team => team.leagueId);

  if (leagueIds.length === 0) return 0;

  const games = await prisma.teamGame.findMany({
    where: {
      isRegularSeason: true,
      pointsScored: { gt: 0 },
      team: { leagueId: { in: leagueIds } },
    },
    select: {
      week: true,
      pointsScored: true,
      sleeperMatchupId: true,
      teamId: true,
      team: {
        select: {
          leagueId: true,
          userId: true,
          league: { select: { year: true } },
        },
      },
    },
  });

  const mine = pairTeamGames(games)
    .filter(pair => pair.game.team.userId === userId)
    .sort(
      (a, b) =>
        a.game.team.league.year - b.game.team.league.year ||
        a.game.week - b.game.week,
    );

  return computeStreak(mine, pair => pair.result === 'W')?.length ?? 0;
}
