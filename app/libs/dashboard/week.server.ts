import { buildMemberWeek, type MemberWeekFacts, type PickWeek } from './week';
import { prisma } from '~/db.server';
import { poolTitle } from '~/libs/survivor/views';
import { getEntryByUserAndYear } from '~/models/fsquared.server';
import { getLocksWeeksByYear } from '~/models/locksweek.server';
import { getCurrentNflWeek, getWeekNflGames } from '~/models/nflgame.server';
import { getPoolWeeksByYear } from '~/models/poolweek.server';
import { hasBeenPlayed, pairTeamGames } from '~/models/profile/shared.server';
import { getQBSelection } from '~/models/qbselection.server';
import { getQBStreamingWeeks } from '~/models/qbstreamingweek.server';
import { getRegistrationByUserAndYear } from '~/models/registration.server';
import type { Season } from '~/models/season.server';
import {
  getTeamGamesByLeagueAndWeek,
  getTeamGameWeeksByLeague,
} from '~/models/teamgame.server';

/** The week's first kickoff, or null when it has no games yet. */
async function firstKickoff(year: number, week: number) {
  const games = await getWeekNflGames(year, week);
  const times = games.map(game => game.gameStartTime.getTime());
  return times.length > 0 ? new Date(Math.min(...times)) : null;
}

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
  const [selection, kickoff] = await Promise.all([
    getQBSelection(week.id, userId),
    firstKickoff(year, week.week),
  ]);
  return {
    id: week.id,
    week: week.week,
    isOpen: week.isOpen,
    isScored: week.isScored,
    picks: selection ? 2 : 0,
    firstKickoff: kickoff,
  };
}

async function spreadPoolFacts(
  userId: string,
  year: number,
): Promise<PickWeek | null> {
  const weeks = await getPoolWeeksByYear(year);
  const week = weeks.find(poolWeek => poolWeek.isOpen) ?? weeks[0];
  if (!week) return null;
  const [picks, kickoff] = await Promise.all([
    prisma.poolGamePick.count({
      where: {
        userId,
        amountBet: { gt: 0 },
        poolGame: { poolWeekId: week.id },
      },
    }),
    firstKickoff(year, week.weekNumber),
  ]);
  return {
    id: week.id,
    week: week.weekNumber,
    isOpen: week.isOpen,
    isScored: week.isWeekScored,
    picks,
    firstKickoff: kickoff,
  };
}

async function locksFacts(
  userId: string,
  year: number,
): Promise<PickWeek | null> {
  const weeks = await getLocksWeeksByYear(year);
  const week = weeks.find(locksWeek => locksWeek.isOpen) ?? weeks[0];
  if (!week) return null;
  const [picks, kickoff] = await Promise.all([
    prisma.locksGamePick.count({
      where: {
        userId,
        isActive: { gt: 0 },
        locksGame: { locksWeekId: week.id },
      },
    }),
    firstKickoff(year, week.weekNumber),
  ]);
  return {
    id: week.id,
    week: week.weekNumber,
    isOpen: week.isOpen,
    isScored: week.isWeekScored,
    picks,
    firstKickoff: kickoff,
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
  const lastScored = userYear.weeks
    .filter(userWeek => userWeek.isScored)
    .sort((a, b) => b.week - a.week)[0];
  return {
    week,
    entries: thisWeek?.entries.length ?? 0,
    isLocked: thisWeek?.isLocked ?? false,
    lastScored: lastScored
      ? {
          week: lastScored.week,
          points: lastScored.entries.reduce((sum, e) => sum + e.points, 0),
        }
      : null,
  };
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
