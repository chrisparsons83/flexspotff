import {
  buildMemberWeek,
  type CupGameSide,
  type GameStanding,
  type MemberWeekFacts,
  type PickWeek,
  cupFacts,
  pointsLeague,
} from './week';
import { prisma } from '~/db.server';
import { getCupBracket } from '~/libs/cup/bracket.server';
import { getLastWeeks, type WeeklyGame } from '~/libs/games/last-week.server';
import { poolTitle } from '~/libs/survivor/views';
import { getEntryByUserAndYear } from '~/models/fsquared.server';
import { getLocksWeeksByYear } from '~/models/locksweek.server';
import { getCurrentNflWeek } from '~/models/nflgame.server';
import { getPoolWeeksByYear } from '~/models/poolweek.server';
import { hasBeenPlayed, pairTeamGames } from '~/models/profile/shared.server';
import {
  dfsSurvivorSeasonTotals,
  fSquaredSeasonTotals,
  locksSeasonTotals,
  qbStreamingSeasonTotals,
  type SeasonTotals,
  spreadPoolSeasonTotals,
} from '~/models/profile/sideGameSeasons.server';
import { STARTING_BANK } from '~/models/profile/spreadPoolProfile';
import { getQBSelection } from '~/models/qbselection.server';
import { getQBStreamingWeeks } from '~/models/qbstreamingweek.server';
import { getRegistrationByUserAndYear } from '~/models/registration.server';
import type { Season } from '~/models/season.server';
import {
  getTeamGamesByLeagueAndWeek,
  getTeamGameWeeksByLeague,
} from '~/models/teamgame.server';
import { assignCompetitionRanks } from '~/utils/rank';

/** The member's matchup in one week of their league, or null. */
async function leagueMatchup(teamId: string, leagueId: string, week: number) {
  const games = await getTeamGamesByLeagueAndWeek(leagueId, week);
  const pair = pairTeamGames(games).find(({ game }) => game.teamId === teamId);
  if (!pair) return null;
  return {
    week,
    points: pair.game.pointsScored,
    opponentPoints: pair.opponent.pointsScored,
    opponent: pair.opponent.team.user?.discordName ?? 'an unclaimed team',
  };
}

async function leagueFacts(
  userId: string,
  year: number,
  week: number | null,
): Promise<MemberWeekFacts['league']> {
  const team = await prisma.team.findFirst({
    where: { userId, league: { year } },
    include: { league: true },
  });
  if (!team) return null;
  // Last week is the newest one with scores, which can trail the calendar
  // by a day or two while the sync catches up.
  const scoredWeeks = await getTeamGameWeeksByLeague(team.leagueId);
  const scored = scoredWeeks.filter(scoredWeek => !week || scoredWeek < week);
  const lastScored = scored.at(-1);
  const [lastWeek, thisWeek] = await Promise.all([
    lastScored ? leagueMatchup(team.id, team.leagueId, lastScored) : null,
    week ? leagueMatchup(team.id, team.leagueId, week) : null,
  ]);
  return {
    name: team.league.name,
    hasScores: scoredWeeks.length > 0,
    lastWeek:
      lastWeek && hasBeenPlayed(lastWeek.points, lastWeek.opponentPoints)
        ? lastWeek
        : null,
    thisWeek: thisWeek && { week: thisWeek.week, opponent: thisWeek.opponent },
  };
}

async function qbStreamingFacts(
  userId: string,
  year: number,
): Promise<PickWeek | null> {
  const week = (await getQBStreamingWeeks(year))[0];
  if (!week) return null;
  const selection = await getQBSelection(week.id, userId);
  return {
    id: week.id,
    week: week.week,
    isOpen: week.isOpen,
    isScored: week.isScored,
    picks: selection ? 2 : 0,
  };
}

async function spreadPoolFacts(
  userId: string,
  year: number,
): Promise<PickWeek | null> {
  const weeks = await getPoolWeeksByYear(year);
  const week = weeks.find(poolWeek => poolWeek.isOpen) ?? weeks[0];
  if (!week) return null;
  const picks = await prisma.poolGamePick.count({
    where: {
      userId,
      amountBet: { gt: 0 },
      poolGame: { poolWeekId: week.id },
    },
  });
  return {
    id: week.id,
    week: week.weekNumber,
    isOpen: week.isOpen,
    isScored: week.isWeekScored,
    picks,
  };
}

async function locksFacts(
  userId: string,
  year: number,
): Promise<PickWeek | null> {
  const weeks = await getLocksWeeksByYear(year);
  const week = weeks.find(locksWeek => locksWeek.isOpen) ?? weeks[0];
  if (!week) return null;
  const picks = await prisma.locksGamePick.count({
    where: {
      userId,
      isActive: { gt: 0 },
      locksGame: { locksWeekId: week.id },
    },
  });
  return {
    id: week.id,
    week: week.weekNumber,
    isOpen: week.isOpen,
    isScored: week.isWeekScored,
    picks,
  };
}

async function dfsSurvivorFacts(
  userId: string,
  year: number,
  week: number | null,
) {
  const userYear = await prisma.dFSSurvivorUserYear.findFirst({
    where: { userId, year },
    include: { weeks: { include: { entries: { select: { points: true } } } } },
  });
  if (!userYear || !week) return null;
  const thisWeek = userYear.weeks.find(userWeek => userWeek.week === week);
  return {
    week,
    entries: thisWeek?.entries.length ?? 0,
    isLocked: thisWeek?.isLocked ?? false,
  };
}

/**
 * Where the member stands in each game they have a scored week in, ranked
 * the way the game's own standings rank it, with how their newest scored
 * week went.
 */
async function standingsFacts(
  userId: string,
  year: number,
): Promise<MemberWeekFacts['standings']> {
  const years = [year];
  const [qbTotals, poolTotals, locksTotals, dfsTotals, fSquaredTotals] =
    await Promise.all([
      qbStreamingSeasonTotals(years),
      spreadPoolSeasonTotals(years),
      locksSeasonTotals(years),
      dfsSurvivorSeasonTotals(years),
      fSquaredSeasonTotals(years),
    ]);

  const place = (
    totals: SeasonTotals,
    format: (total: number) => string,
  ): Omit<GameStanding, 'lastWeek' | 'lastWeekRank'> | null => {
    const byUser = totals.get(year);
    if (!byUser?.has(userId)) return null;
    const ranked = assignCompetitionRanks(
      [...byUser.entries()]
        .map(([id, total]) => ({ id, total }))
        .sort((a, b) => b.total - a.total),
      row => row.total,
    );
    const mine = ranked.find(row => row.id === userId)!;
    return { rank: mine.rank, of: ranked.length, total: format(mine.total) };
  };

  const qb = place(qbTotals, total => total.toFixed(2));
  const pool = place(poolTotals, net => `${STARTING_BANK + net} bank`);
  const locks = place(locksTotals, points => `${points}`);
  const dfs = place(dfsTotals, total => total.toFixed(2));
  const fSquared = place(fSquaredTotals, total => total.toFixed(2));

  // How each game's newest scored week went for them. A game they have a
  // standing in but no result that week shows they had no picks in.
  const weeks = await getLastWeeks(year);
  const lastWeek = (game: WeeklyGame, missing: string | null) => {
    const week = weeks[game];
    const mine = week?.results.find(result => result.userId === userId);
    return {
      lastWeek: mine?.label ?? (week ? missing : null),
      lastWeekRank: mine?.rank ?? null,
    };
  };
  const none = { lastWeek: null, lastWeekRank: null };

  const standings: MemberWeekFacts['standings'] = {};
  if (qb)
    standings.qbStreaming = { ...qb, ...lastWeek('qbStreaming', 'No Picks') };
  if (pool) standings.spreadPool = { ...pool, ...lastWeek('spreadPool', null) };
  if (locks) standings.locks = { ...locks, ...lastWeek('locks', 'No Picks') };
  if (dfs) standings.dfsSurvivor = { ...dfs, ...lastWeek('dfsSurvivor', null) };
  if (fSquared) standings.fSquared = { ...fSquared, ...none };
  return standings;
}

/** The member's place in this year's cup, from the bracket's own query. */
async function memberCupFacts(userId: string, year: number) {
  const bracket = await getCupBracket(year);
  if (!bracket) return null;
  const side = (
    cupTeam: (typeof bracket.cupGames)[number]['topTeam'],
  ): CupGameSide | null =>
    cupTeam && {
      cupTeamId: cupTeam.id,
      teamId: cupTeam.teamId,
      userId: cupTeam.team.userId,
      name: cupTeam.team.user?.discordName ?? 'an unclaimed team',
    };
  return cupFacts(
    bracket.cupGames.map(game => ({
      round: game.round,
      top: side(game.topTeam),
      bottom: side(game.bottomTeam),
      winningTeamId: game.winningTeamId,
    })),
    bracket.scoreArray,
    userId,
  );
}

/** The member's D12 season, if they are in this year's. */
async function d12Facts(userId: string, year: number, week: number | null) {
  const where = { league: { season: { year } } };
  const [scores, picks] = await Promise.all([
    prisma.d12WeekScore.findMany({
      where,
      select: { userId: true, week: true, points: true },
    }),
    prisma.d12DraftPick.count({ where: { ...where, userId } }),
  ]);
  if (picks === 0 && !scores.some(score => score.userId === userId)) {
    return null;
  }
  return pointsLeague(
    scores.map(score => ({
      entrant: score.userId,
      week: score.week,
      points: score.points ?? 0,
    })),
    userId,
    week,
  );
}

/** The member's Autodraft BBM season, ranked by team, if they have one. */
async function bestBallFacts(
  userId: string,
  year: number,
  week: number | null,
) {
  const team = await prisma.bestBallTeam.findFirst({
    where: { userId, league: { season: { year } } },
    select: { id: true, bestBallLeagueId: true },
  });
  if (!team) return null;
  const scores = await prisma.bestBallWeekScore.findMany({
    where: { team: { bestBallLeagueId: team.bestBallLeagueId } },
    select: { bestBallTeamId: true, week: true, points: true },
  });
  return pointsLeague(
    scores.map(score => ({
      entrant: score.bestBallTeamId,
      week: score.week,
      points: score.points,
    })),
    team.id,
    week,
  );
}

/** The member's week, every row ready for the dashboard. */
export async function getMemberWeek(userId: string, season: Season) {
  const { year } = season;
  const week = await getCurrentNflWeek(year, new Date());

  const [
    league,
    guillotine,
    qbStreaming,
    spreadPool,
    locks,
    dfsSurvivor,
    survivor,
    fSquaredEntry,
    registration,
    standings,
    cup,
    d12,
    bestBall,
  ] = await Promise.all([
    leagueFacts(userId, year, week),
    prisma.guillotineTeam.findMany({
      where: { userId, league: { season: { year } } },
      include: { league: { select: { id: true, name: true } } },
    }),
    qbStreamingFacts(userId, year),
    spreadPoolFacts(userId, year),
    locksFacts(userId, year),
    dfsSurvivorFacts(userId, year, week),
    prisma.survivorEntry.findMany({
      where: { userId, pool: { year } },
      include: { pool: true },
    }),
    season.isOpenForFSquared ? getEntryByUserAndYear(userId, year) : null,
    season.isOpenForRegistration
      ? getRegistrationByUserAndYear(userId, year)
      : null,
    standingsFacts(userId, year),
    memberCupFacts(userId, year),
    d12Facts(userId, year, week),
    bestBallFacts(userId, year, week),
  ]);

  return buildMemberWeek({
    year,
    league,
    cup,
    guillotine: guillotine.map(team => ({
      leagueId: team.league.id,
      name: team.league.name,
      choppedWeek: team.choppedWeek,
      finish: team.finish,
    })),
    qbStreaming,
    spreadPool,
    locks,
    dfsSurvivor,
    standings,
    survivor: survivor.map(entry => ({
      poolId: entry.pool.id,
      name: poolTitle(entry.pool),
      alive: entry.eliminatedWeek === null,
    })),
    d12,
    bestBall,
    fSquared: {
      isOpen: season.isOpenForFSquared,
      hasEntry: !!fSquaredEntry,
    },
    registration: {
      isOpen: season.isOpenForRegistration,
      isRegistered: !!registration,
    },
  });
}
