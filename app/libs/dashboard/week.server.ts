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
import { poolTitle } from '~/libs/survivor/views';
import { getEntryByUserAndYear } from '~/models/fsquared.server';
import { getLocksGamePicksWonLossWeek } from '~/models/locksgamepicks.server';
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
import {
  getQBSelection,
  getQBSelectionsByWeek,
} from '~/models/qbselection.server';
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

  const none = { lastWeek: null, lastWeekRank: null };
  const [qbLast, poolLast, locksLast, dfsLast] = await Promise.all([
    qb ? qbLastWeek(userId, year) : none,
    pool ? poolLastWeek(userId, year) : none,
    locks ? locksLastWeek(userId, year) : none,
    dfs ? dfsLastWeek(userId, year) : none,
  ]);

  const standings: MemberWeekFacts['standings'] = {};
  if (qb) standings.qbStreaming = { ...qb, ...qbLast };
  if (pool) standings.spreadPool = { ...pool, ...poolLast };
  if (locks) standings.locks = { ...locks, ...locksLast };
  if (dfs) standings.dfsSurvivor = { ...dfs, ...dfsLast };
  if (fSquared) standings.fSquared = { ...fSquared, ...none };
  return standings;
}

type LastWeek = Pick<GameStanding, 'lastWeek' | 'lastWeekRank'>;

/** The member's place among a week's scores, best first, ties sharing. */
const rankIn = (scores: Map<string, number>, userId: string) => {
  if (!scores.has(userId)) return null;
  return assignCompetitionRanks(
    [...scores.entries()]
      .map(([id, score]) => ({ id, score }))
      .sort((a, b) => b.score - a.score),
    row => row.score,
  ).find(row => row.id === userId)!.rank;
};

/** The member's two quarterbacks' points in the newest scored week. */
async function qbLastWeek(userId: string, year: number): Promise<LastWeek> {
  const week = (await getQBStreamingWeeks(year)).find(
    qbWeek => qbWeek.isScored,
  );
  if (!week) return { lastWeek: null, lastWeekRank: null };
  const selections = await getQBSelectionsByWeek(week.id);
  const totals = new Map(
    selections.map(selection => [
      selection.userId,
      selection.standardPlayer.pointsScored + selection.deepPlayer.pointsScored,
    ]),
  );
  const total = totals.get(userId);
  return {
    lastWeek: total === undefined ? 'No Picks' : total.toFixed(2),
    lastWeekRank: rankIn(totals, userId),
  };
}

/** What the member won or lost in the newest scored week, missed weeks too. */
async function poolLastWeek(userId: string, year: number): Promise<LastWeek> {
  const week = (await getPoolWeeksByYear(year)).find(
    poolWeek => poolWeek.isWeekScored,
  );
  if (!week) return { lastWeek: null, lastWeekRank: null };
  const [bets, missed] = await Promise.all([
    prisma.poolGamePick.groupBy({
      by: ['userId'],
      where: { amountBet: { gt: 0 }, poolGame: { poolWeekId: week.id } },
      _sum: { resultWonLoss: true },
    }),
    prisma.poolWeekMissed.groupBy({
      by: ['userId'],
      where: { poolWeekId: week.id },
      _sum: { resultWonLoss: true },
    }),
  ]);
  const nets = new Map<string, number>();
  for (const row of [...bets, ...missed]) {
    nets.set(
      row.userId,
      (nets.get(row.userId) ?? 0) + (row._sum.resultWonLoss ?? 0),
    );
  }
  const net = nets.get(userId) ?? 0;
  const bet = bets.some(row => row.userId === userId);
  return {
    lastWeek: `${signed(net)}${bet ? '' : ', missed'}`,
    lastWeekRank: rankIn(nets, userId),
  };
}

/** The member's points and record in the newest scored week. */
async function locksLastWeek(userId: string, year: number): Promise<LastWeek> {
  const week = (await getLocksWeeksByYear(year)).find(
    locksWeek => locksWeek.isWeekScored,
  );
  if (!week) return { lastWeek: null, lastWeekRank: null };
  const [mine, everyone] = await Promise.all([
    prisma.locksGamePick.aggregate({
      where: {
        userId,
        isActive: { gt: 0 },
        locksGame: { locksWeekId: week.id },
      },
      _sum: { isWin: true, isLoss: true, isTie: true },
      _count: true,
    }),
    getLocksGamePicksWonLossWeek(week),
  ]);
  if (mine._count === 0) return { lastWeek: 'No Picks', lastWeekRank: null };
  const sum = mine._sum;
  return {
    lastWeek: `${locksWeekPoints(sum)} (${sum.isWin ?? 0}-${sum.isLoss ?? 0}-${
      sum.isTie ?? 0
    })`,
    lastWeekRank: rankIn(
      new Map(everyone.map(row => [row.userId, locksWeekPoints(row._sum)])),
      userId,
    ),
  };
}

/** The member's lineup total in their newest scored DFS Survivor week. */
async function dfsLastWeek(userId: string, year: number): Promise<LastWeek> {
  const mine = await prisma.dFSSurvivorUserWeek.findFirst({
    where: { userId, year, isScored: true },
    orderBy: { week: 'desc' },
    select: { week: true },
  });
  if (!mine) return { lastWeek: null, lastWeekRank: null };
  const weeks = await prisma.dFSSurvivorUserWeek.findMany({
    where: { year, week: mine.week, isScored: true },
    select: { userId: true, entries: { select: { points: true } } },
  });
  const totals = new Map(
    weeks.map(week => [
      week.userId,
      week.entries.reduce((sum, entry) => sum + entry.points, 0),
    ]),
  );
  return {
    lastWeek: totals.get(userId)?.toFixed(2) ?? null,
    lastWeekRank: rankIn(totals, userId),
  };
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
