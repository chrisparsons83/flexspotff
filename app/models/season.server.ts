import type { Season } from '@prisma/client';
import { prisma } from '~/db.server';

export type { Season } from '@prisma/client';

export type SeasonCreate = Omit<Season, 'id' | 'createdAt' | 'updatedAt'>;

export async function createSeason(data: SeasonCreate) {
  return prisma.season.create({
    data,
  });
}

export async function getCurrentSeason() {
  return prisma.season.findFirst({
    where: {
      isCurrent: true,
    },
  });
}

/**
 * The leagues whose season is still being played: this year's, until their
 * title game has been decided or the season's last week is over.
 *
 * Anything that averages or compares whole seasons has to leave these out. A
 * season five weeks in has a third of a season's points, so counting it drags
 * every per-season average down, and a hot start tops a win percentage table.
 * Past years count as finished whatever their brackets say, since some old
 * leagues were never synced with one. The calendar is the same backstop for
 * this year: a league whose bracket never synced would otherwise sit
 * unfinished all offseason.
 */
export async function getUnfinishedLeagueIds(): Promise<Set<string>> {
  const season = await getCurrentSeason();
  if (!season) return new Set();

  const lastWeek = await prisma.seasonWeek.findFirst({
    where: { seasonId: season.id },
    orderBy: { weekEnd: 'desc' },
    select: { weekEnd: true },
  });
  if (lastWeek && lastWeek.weekEnd < new Date()) return new Set();

  const leagues = await prisma.league.findMany({
    where: {
      year: season.year,
      NOT: {
        playoffGames: {
          some: {
            bracket: 'WINNERS',
            isTitleGame: true,
            advancingTeamId: { not: null },
          },
        },
      },
    },
    select: { id: true },
  });

  return new Set(leagues.map(league => league.id));
}

export async function getSeason(year: Season['year']) {
  return prisma.season.findFirst({
    where: {
      year,
    },
  });
}

export async function getSeasonById(id: Season['id']) {
  return prisma.season.findUnique({
    where: {
      id,
    },
  });
}

export async function getSeasons() {
  return prisma.season.findMany({
    orderBy: [
      {
        year: 'desc',
      },
    ],
  });
}

export async function updateSeason(season: Partial<Season>) {
  return prisma.season.update({
    where: {
      id: season.id,
    },
    data: season,
  });
}

export async function deleteSeason(id: Season['id']) {
  return prisma.season.delete({
    where: {
      id,
    },
  });
}

export async function updateActiveSeason(id: Season['id']) {
  return prisma.$transaction([
    prisma.season.updateMany({
      data: {
        isCurrent: false,
      },
    }),
    prisma.season.update({
      where: {
        id: id,
      },
      data: {
        isCurrent: true,
      },
    }),
  ]);
}
