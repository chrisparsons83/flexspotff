import {
  buildD12Career,
  buildD12DraftBoard,
  buildD12Seasons,
  type D12Board,
  type D12BoardPlayer,
  type D12Finish,
  type D12ScoreRow,
} from './d12Profile';
import { prisma } from '~/db.server';
import { getNewestD12WeekByYear } from '~/models/d12weekscore.server';
import { getPlayersBySleepersIds } from '~/models/players.server';
import { getCurrentSeason } from '~/models/season.server';
import { assignCompetitionRanks } from '~/utils/rank';

/**
 * Everything the D12 tab shows. Ranks come from summing every manager's points
 * for the year, the same total the season leaderboard sorts on.
 */
export async function getD12Profile(userId: string) {
  const scores = await prisma.d12WeekScore.findMany({
    where: { userId },
    select: {
      week: true,
      points: true,
      starters: true,
      startingPlayerPoints: true,
      league: {
        select: { id: true, name: true, season: { select: { year: true } } },
      },
    },
  });

  if (scores.length === 0) return { hasPlayed: false as const };

  const rows: D12ScoreRow[] = scores.map(score => ({
    year: score.league.season.year,
    week: score.week,
    points: score.points,
    leagueId: score.league.id,
    leagueName: score.league.name,
    starters: score.starters,
    startingPlayerPoints: score.startingPlayerPoints,
  }));
  const years = Array.from(new Set(rows.map(row => row.year))).sort(
    (a, b) => b - a,
  );

  const inProgressYear = (await getCurrentSeason())?.year ?? null;
  const [finishes, newestWeekInProgress, boards] = await Promise.all([
    getFinishes(userId, years),
    inProgressYear !== null && years.includes(inProgressYear)
      ? getNewestD12WeekByYear(inProgressYear)
      : Promise.resolve(null),
    getDraftBoards(userId, years, rows),
  ]);

  const seasons = buildD12Seasons({
    rows,
    finishes,
    inProgressYear,
    newestWeekInProgress,
  });

  return {
    hasPlayed: true as const,
    career: buildD12Career(seasons),
    seasons,
    boards,
  };
}

/** Where the member finished each year, among everyone who scored that year. */
async function getFinishes(userId: string, years: number[]) {
  const finishes = new Map<number, D12Finish>();

  await Promise.all(
    years.map(async year => {
      const totals = await prisma.d12WeekScore.groupBy({
        by: ['userId'],
        where: { league: { season: { year } } },
        _sum: { points: true },
      });
      const ranked = assignCompetitionRanks(
        totals
          .map(total => ({
            userId: total.userId,
            points: total._sum.points ?? 0,
          }))
          .sort((a, b) => b.points - a.points),
        entry => entry.points,
      );
      const mine = ranked.find(entry => entry.userId === userId);
      if (mine)
        finishes.set(year, { rank: mine.rank, fieldSize: ranked.length });
    }),
  );

  return finishes;
}

/** One combined board per year they have picks for, newest first. */
async function getDraftBoards(
  userId: string,
  years: number[],
  rows: D12ScoreRow[],
): Promise<D12Board[]> {
  const leagues = await prisma.d12League.findMany({
    where: { season: { year: { in: years } } },
    select: { id: true, name: true, season: { select: { year: true } } },
  });
  const leagueIds = leagues.map(league => league.id);

  const picks = await prisma.d12DraftPick.findMany({
    where: { userId, d12LeagueId: { in: leagueIds } },
    select: { d12LeagueId: true, pickNo: true, sleeperId: true },
  });
  if (picks.length === 0) return [];

  const players = new Map<string, D12BoardPlayer>();
  for (const player of await getPlayersBySleepersIds(
    Array.from(new Set(picks.map(pick => pick.sleeperId))),
  )) {
    players.set(player.sleeperId, {
      firstName: player.firstName,
      lastName: player.lastName,
      position: player.position,
      nflTeam: player.nflTeam,
    });
  }

  return years
    .map(year => {
      const yearLeagues = leagues
        .filter(league => league.season.year === year)
        .map(league => ({ id: league.id, name: league.name }));
      const yearLeagueIds = new Set(yearLeagues.map(league => league.id));

      return buildD12DraftBoard({
        year,
        leagues: yearLeagues,
        picks: picks
          .filter(pick => yearLeagueIds.has(pick.d12LeagueId))
          .map(pick => ({
            leagueId: pick.d12LeagueId,
            pickNo: pick.pickNo,
            sleeperId: pick.sleeperId,
          })),
        rows: rows.filter(row => row.year === year),
        players,
      });
    })
    .filter(board => board.rounds > 0);
}
