import {
  BADGE_DEFINITIONS,
  SIDE_GAME_KEYS,
  makeBadge,
  makeSideGameBadge,
  type Badge,
} from './badges';
import {
  aggregatePlayoffStats,
  buildLeagueHighlights,
  memberSinceYear,
  settledLeagueGames,
  winPct,
} from './shared.server';
import { getSideGameTitles } from './sideGameTitles.server';
import { prisma } from '~/db.server';
import { getSeasonState, type SeasonState } from '~/models/seasonState.server';
import { regularSeasonIsOver } from '~/utils/seasonStructure';

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
    handle: string;
    discordId: string;
    discordName: string;
    discordAvatar: string;
    discordUsername: string | null;
    discordUserAvatar: string | null;
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
      handle: true,
      discordId: true,
      discordName: true,
      discordAvatar: true,
      discordUsername: true,
      discordUserAvatar: true,
      createdAt: true,
    },
  });

  if (!user) return null;

  const [
    state,
    teams,
    allPlayoffGames,
    cupFinalWins,
    cupSeasons,
    d12Count,
    qbCount,
    poolCount,
    locksCount,
    dfs,
    fSquared,
    fSquaredPicked,
    guillotineTeams,
    bestBallTeams,
    survivorEntries,
  ] = await Promise.all([
    getSeasonState(),
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
        pointsAgainst: true,
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
        // The tier tells a Champions League title from any other one; the
        // rest says whether the bracket is real yet.
        league: { select: { tier: true, year: true, playoffWeekStart: true } },
      },
    }),
    prisma.cupGame.count({
      where: { round: 'ROUND_OF_2', winningTeam: { team: { userId } } },
    }),
    prisma.cupTeam.count({ where: { team: { userId } } }),
    prisma.d12WeekScore.count({ where: { userId } }),
    prisma.qBSelection.count({ where: { userId } }),
    prisma.poolGamePick.count({ where: { userId } }),
    // Scored picks only: saving an empty entry writes inactive rows, and that
    // alone should not open the tab.
    prisma.locksGamePick.count({
      where: { userId, isScored: true, isActive: { gt: 0 } },
    }),
    // Aggregated rather than counted so these also report the earliest year
    // played - see memberSince below. Same query, one more column.
    // Entries in scored weeks, not season rows: a season is created with its
    // seventeen weeks up front, so a member can have one and never have set
    // a lineup.
    prisma.dFSSurvivorUserEntry.aggregate({
      where: { userId, userWeek: { isScored: true } },
      _count: { _all: true },
      _min: { year: true },
    }),
    prisma.fSquaredEntry.aggregate({
      where: { userId },
      _count: { _all: true },
      _min: { year: true },
    }),
    // F² is played on other people's entries too: a member whose team was
    // picked has a tab saying who backed them, even if they never entered.
    prisma.team.count({
      where: { userId, FSquaredSelections: { some: {} } },
    }),
    // The years too, since guillotine seasons count towards memberSince.
    prisma.guillotineTeam.findMany({
      where: { userId },
      select: { league: { select: { season: { select: { year: true } } } } },
    }),
    // Same again for best ball.
    prisma.bestBallTeam.findMany({
      where: { userId },
      select: { league: { select: { season: { select: { year: true } } } } },
    }),
    // And survivor, which keeps its year on the pool.
    prisma.survivorEntry.findMany({
      where: { userId },
      select: { pool: { select: { year: true } } },
    }),
  ]);

  const career = teams.reduce(
    (acc, team) => ({
      wins: acc.wins + team.wins,
      losses: acc.losses + team.losses,
      ties: acc.ties + team.ties,
      pointsFor: acc.pointsFor + team.pointsFor,
      pointsAgainst: acc.pointsAgainst + team.pointsAgainst,
    }),
    { wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0 },
  );

  // Same rule as the League tab: nothing from a bracket counts until the
  // regular season it was seeded from is over.
  const playoffGames = allPlayoffGames.filter(game =>
    regularSeasonIsOver(game.league, state),
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
    [
      ...teams.map(team => team.league.year),
      ...guillotineTeams.map(team => team.league.season.year),
      ...bestBallTeams.map(team => team.league.season.year),
      ...survivorEntries.map(entry => entry.pool.year),
      dfs._min.year,
      fSquared._min.year,
    ],
    user.createdAt.getFullYear(),
  );
  const championsSeasons = teams.filter(team => team.league.tier === 1).length;

  const contestsPlayed = [
    teams.length > 0 && 'league',
    cupSeasons > 0 && 'cup',
    d12Count > 0 && 'd12',
    guillotineTeams.length > 0 && 'guillotine',
    bestBallTeams.length > 0 && 'best-ball',
    survivorEntries.length > 0 && 'survivor',
    qbCount > 0 && 'qb-streaming',
    poolCount > 0 && 'spread-pool',
    locksCount > 0 && 'locks',
    dfs._count._all > 0 && 'dfs-survivor',
    (fSquared._count._all > 0 || fSquaredPicked > 0) && 'f-squared',
  ].filter((value): value is string => typeof value === 'string');

  const [highlights, titles] = await Promise.all([
    getLeagueHighlights(userId, state),
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
      highlights.bestWeek?.points ?? 0,
    ),
    makeBadge(BADGE_DEFINITIONS.winStreak, highlights.longestWinStreak),
  ].filter((badge): badge is Badge => badge !== null);

  return {
    user: {
      id: user.id,
      handle: user.handle,
      discordId: user.discordId,
      discordName: user.discordName,
      discordAvatar: user.discordAvatar,
      discordUsername: user.discordUsername,
      discordUserAvatar: user.discordUserAvatar,
      memberSince,
    },
    headline: [
      { label: 'Seasons', value: teams.length.toString() },
      { label: 'League Championships', value: championships.toString() },
      {
        label: 'Career Record',
        value: `${career.wins}-${career.losses}-${career.ties}`,
      },
      { label: 'Win %', value: `${(winPct(career) * 100).toFixed(1)}%` },
      { label: 'Points For', value: Math.round(career.pointsFor).toString() },
      {
        label: 'Points Against',
        value: Math.round(career.pointsAgainst).toString(),
      },
    ],
    badges,
    contestsPlayed,
  };
}

/**
 * The member's best week and longest win streak, for their badges.
 *
 * Read through the same `settledLeagueGames` and `buildLeagueHighlights` as the
 * League tab, so a badge can never be ahead of the tile on the page beneath it
 * - the streak badge used to count playoff games differently, and the best week
 * badge used to count a week still being played.
 *
 * Every game in the leagues they played is fetched, not just their own, because
 * a result only exists once both sides of a matchup are known - that is what
 * pairTeamGames needs.
 */
async function getLeagueHighlights(userId: string, state: SeasonState) {
  const leagueIds = (
    await prisma.team.findMany({
      where: { userId },
      select: { leagueId: true },
    })
  ).map(team => team.leagueId);

  const games =
    leagueIds.length === 0
      ? []
      : await prisma.teamGame.findMany({
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

  return buildLeagueHighlights(
    settledLeagueGames(games, state)
      .filter(pair => pair.game.team.userId === userId)
      .map(pair => ({
        year: pair.game.team.league.year,
        week: pair.game.week,
        pointsScored: pair.game.pointsScored,
        result: pair.result,
      })),
  );
}
