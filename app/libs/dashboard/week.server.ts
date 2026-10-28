import {
  buildMemberWeek,
  type GameStanding,
  type MemberWeekFacts,
  type PickWeek,
} from './week';
import { prisma } from '~/db.server';
import { poolTitle } from '~/libs/survivor/views';
import { getEntryByUserAndYear } from '~/models/fsquared.server';
import { getLocksWeeksByYear } from '~/models/locksweek.server';
import { getCurrentNflWeek } from '~/models/nflgame.server';
import { getPoolWeeksByYear } from '~/models/poolweek.server';
import { hasBeenPlayed, pairTeamGames } from '~/models/profile/shared.server';
import { locksWeekPoints } from '~/models/profile/sideGameScoring';
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
  const scored = (await getTeamGameWeeksByLeague(team.leagueId)).filter(
    scoredWeek => !week || scoredWeek < week,
  );
  const lastScored = scored.at(-1);
  const [lastWeek, thisWeek] = await Promise.all([
    lastScored ? leagueMatchup(team.id, team.leagueId, lastScored) : null,
    week ? leagueMatchup(team.id, team.leagueId, week) : null,
  ]);
  return {
    name: team.league.name,
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

const signed = (net: number) => (net > 0 ? `+${net}` : `${net}`);

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
  ): Omit<GameStanding, 'lastWeek'> | null => {
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

  const qb = place(qbTotals, total => `${total.toFixed(2)} pts`);
  const pool = place(poolTotals, net => `${STARTING_BANK + net} bank`);
  const locks = place(locksTotals, points => `${points} pts`);
  const dfs = place(dfsTotals, total => `${total.toFixed(2)} pts`);
  const fSquared = place(fSquaredTotals, total => `${total.toFixed(2)} pts`);

  const [qbLast, poolLast, locksLast, dfsLast] = await Promise.all([
    qb ? qbLastWeek(userId, year) : null,
    pool ? poolLastWeek(userId, year) : null,
    locks ? locksLastWeek(userId, year) : null,
    dfs
      ? prisma.dFSSurvivorUserWeek.findFirst({
          where: { userId, year, isScored: true },
          orderBy: { week: 'desc' },
          include: { entries: { select: { points: true } } },
        })
      : null,
  ]);

  const standings: MemberWeekFacts['standings'] = {};
  if (qb) standings.qbStreaming = { ...qb, lastWeek: qbLast };
  if (pool) standings.spreadPool = { ...pool, lastWeek: poolLast };
  if (locks) standings.locks = { ...locks, lastWeek: locksLast };
  if (dfs) {
    standings.dfsSurvivor = {
      ...dfs,
      lastWeek: dfsLast
        ? `Week ${dfsLast.week}: ${dfsLast.entries
            .reduce((sum, entry) => sum + entry.points, 0)
            .toFixed(2)}`
        : null,
    };
  }
  if (fSquared) standings.fSquared = { ...fSquared, lastWeek: null };
  return standings;
}

/** The member's two quarterbacks' points in the newest scored week. */
async function qbLastWeek(userId: string, year: number) {
  const week = (await getQBStreamingWeeks(year)).find(
    qbWeek => qbWeek.isScored,
  );
  if (!week) return null;
  const selection = await getQBSelection(week.id, userId);
  return `Week ${week.week}: ${
    selection
      ? (
          selection.standardPlayer.pointsScored +
          selection.deepPlayer.pointsScored
        ).toFixed(2)
      : 'no picks'
  }`;
}

/** What the member won or lost in the newest scored week, missed weeks too. */
async function poolLastWeek(userId: string, year: number) {
  const week = (await getPoolWeeksByYear(year)).find(
    poolWeek => poolWeek.isWeekScored,
  );
  if (!week) return null;
  const [bets, missed] = await Promise.all([
    prisma.poolGamePick.aggregate({
      where: {
        userId,
        amountBet: { gt: 0 },
        poolGame: { poolWeekId: week.id },
      },
      _sum: { resultWonLoss: true },
      _count: true,
    }),
    prisma.poolWeekMissed.aggregate({
      where: { userId, poolWeekId: week.id },
      _sum: { resultWonLoss: true },
    }),
  ]);
  const net = (bets._sum.resultWonLoss ?? 0) + (missed._sum.resultWonLoss ?? 0);
  return `Week ${week.weekNumber}: ${signed(net)}${
    bets._count === 0 ? ', missed' : ''
  }`;
}

/** The member's points and record in the newest scored week. */
async function locksLastWeek(userId: string, year: number) {
  const week = (await getLocksWeeksByYear(year)).find(
    locksWeek => locksWeek.isWeekScored,
  );
  if (!week) return null;
  const { _sum: sum, _count: count } = await prisma.locksGamePick.aggregate({
    where: { userId, isActive: { gt: 0 }, locksGame: { locksWeekId: week.id } },
    _sum: { isWin: true, isLoss: true, isTie: true },
    _count: true,
  });
  if (count === 0) return `Week ${week.weekNumber}: no picks`;
  const points = locksWeekPoints(sum);
  return `Week ${week.weekNumber}: ${points} ${points === 1 ? 'pt' : 'pts'} (${
    sum.isWin ?? 0
  }-${sum.isLoss ?? 0}-${sum.isTie ?? 0})`;
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
  ]);

  return buildMemberWeek({
    year,
    league,
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
