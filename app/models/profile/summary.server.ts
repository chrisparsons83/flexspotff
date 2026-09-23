import {
  BADGE_DEFINITIONS,
  SIDE_GAME_KEYS,
  makeBadge,
  makeSideGameBadge,
  type Badge,
} from './badges';
import {
  aggregatePlayoffStats,
  computeStreak,
  memberSinceYear,
  pairTeamGames,
  winPct,
} from './shared.server';
import { getSideGameTitles } from './sideGameTitles.server';
import { prisma } from '~/db.server';

export type { Badge } from './badges';

/**
 * The profile hero: who this is, their career headline numbers, and their
 * badges.
 *
 * This is the one query that runs on every tab, so it is deliberately the
 * narrowest of the profile aggregations - counts and sums, no game logs. If
 * profiles ever need caching, this is the function to cache.
 */

export type ProfileSummary = {
  user: {
    id: string;
    discordName: string;
    discordAvatar: string;
    /** First year this member shows up anywhere, not when their account was made. */
    memberSince: number;
  };
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
    bestWeek,
    d12Count,
    qbCount,
    poolCount,
    locksCount,
    dfs,
    fSquared,
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
        losingTeam: { select: { userId: true } },
        advancingTeam: { select: { userId: true } },
        // Only to tell a Champions League title from any other one.
        league: { select: { tier: true } },
      },
    }),
    prisma.cupGame.count({
      where: { round: 'ROUND_OF_2', winningTeam: { team: { userId } } },
    }),
    prisma.cupTeam.count({ where: { team: { userId } } }),
    prisma.teamGame.aggregate({
      where: { team: { userId } },
      _max: { pointsScored: true },
    }),
    prisma.d12WeekScore.count({ where: { userId } }),
    prisma.qBSelection.count({ where: { userId } }),
    prisma.poolGamePick.count({ where: { userId } }),
    prisma.locksGamePick.count({ where: { userId } }),
    // Aggregated rather than counted so these also report the earliest year
    // played - see memberSince below. Same query, one more column.
    prisma.dFSSurvivorUserYear.aggregate({
      where: { userId },
      _count: { _all: true },
      _min: { year: true },
    }),
    prisma.fSquaredEntry.aggregate({
      where: { userId },
      _count: { _all: true },
      _min: { year: true },
    }),
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
  const sackos = playoffs?.sackos ?? 0;

  // Winning the top tier is its own award, so it is counted here rather than
  // pulled out of the career totals - a title is a title, and this is the one
  // that says which league it was won in.
  const championOfChampions = playoffGames.filter(
    game =>
      game.bracket === 'WINNERS' &&
      game.isTitleGame &&
      game.league.tier === 1 &&
      game.advancingTeam?.userId === userId,
  ).length;

  // The year a member has been around since is the earliest year they actually
  // turn up, not when their account was made - see memberSinceYear. League
  // seasons come free from `teams`; DFS Survivor and F-Squared are the side
  // games that keep a year on the row we already aggregate. The rest reach
  // their year only through a join, and a member who played one of those and
  // nothing else does not exist yet, so they fall back to the account date.
  const memberSince = memberSinceYear(
    [...teams.map(team => team.league.year), dfs._min.year, fSquared._min.year],
    user.createdAt.getFullYear(),
  );
  const championsSeasons = teams.filter(team => team.league.tier === 1).length;

  const contestsPlayed = [
    teams.length > 0 && 'league',
    cupSeasons > 0 && 'cup',
    d12Count > 0 && 'd12',
    qbCount > 0 && 'qb-streaming',
    poolCount > 0 && 'spread-pool',
    locksCount > 0 && 'locks',
    dfs._count._all > 0 && 'dfs-survivor',
    fSquared._count._all > 0 && 'f-squared',
  ].filter((value): value is string => typeof value === 'string');

  const [longestStreak, titles] = await Promise.all([
    getLongestWinStreak(userId),
    getSideGameTitles(userId),
  ]);

  const badges = [
    makeBadge(BADGE_DEFINITIONS.championOfChampions, championOfChampions),
    makeBadge(BADGE_DEFINITIONS.leagueChampion, championships),
    makeBadge(BADGE_DEFINITIONS.cupChampion, cupFinalWins),
    makeBadge(BADGE_DEFINITIONS.sacko, sackos),
    ...SIDE_GAME_KEYS.map(game => makeSideGameBadge(game, titles[game] ?? 0)),
    makeBadge(BADGE_DEFINITIONS.championsLeague, championsSeasons),
    makeBadge(BADGE_DEFINITIONS.seasonsPlayed, teams.length),
    makeBadge(
      BADGE_DEFINITIONS.highScoringWeek,
      bestWeek._max.pointsScored ?? 0,
    ),
    makeBadge(BADGE_DEFINITIONS.winStreak, longestStreak),
  ].filter((badge): badge is Badge => badge !== null);

  return {
    user: {
      id: user.id,
      discordName: user.discordName,
      discordAvatar: user.discordAvatar,
      memberSince,
    },
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
 * Postseason games count, so a playoff win extends a streak rather than ending
 * it. This used to read the regular season only, which put the badge one ahead
 * of the Longest Win Streak tile on the same page - a playoff loss between two
 * regular-season wins joined them into one run here and broke them into two
 * there.
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
    .filter(
      pair =>
        pair.game.team.userId === userId &&
        // A week that has opened but not been scored is not a loss. Checked on
        // the pair rather than in the query, because dropping a scoreless row
        // in SQL would take its opponent's real result down with it.
        (pair.game.pointsScored > 0 || pair.opponent.pointsScored > 0) &&
        pair.game.pointsScored > 0,
    )
    .sort(
      (a, b) =>
        a.game.team.league.year - b.game.team.league.year ||
        a.game.week - b.game.week,
    );

  return computeStreak(mine, pair => pair.result === 'W')?.length ?? 0;
}
