import type {
  DFSSurvivorUserEntry,
  DFSSurvivorUserWeek,
  Player,
} from '@prisma/client';
import { prisma } from '~/db.server';

export type { DFSSurvivorUserWeek } from '@prisma/client';

/** One user's week with every entry it holds, player included. */
export type DfsSurvivorWeekWithEntries = DFSSurvivorUserWeek & {
  entries: (DFSSurvivorUserEntry & { player: Player })[];
};

export async function getDfsSurvivorWeeksByYear(year: number) {
  return prisma.dFSSurvivorUserWeek.findMany({
    where: {
      year,
    },
    orderBy: {
      week: 'asc',
    },
  });
}

export async function getDfsSurvivorWeekByYearAndWeek(
  year: number,
  week: number,
) {
  return prisma.dFSSurvivorUserWeek.findFirst({
    where: {
      year,
      week,
    },
  });
}

/** Every user's week row for one NFL week, with the entries to score. */
export async function getDfsSurvivorWeeksWithEntries(
  year: number,
  week: number,
): Promise<DfsSurvivorWeekWithEntries[]> {
  return prisma.dFSSurvivorUserWeek.findMany({
    where: { year, week },
    include: {
      entries: {
        include: {
          player: true,
        },
      },
    },
  });
}

/** Marks every user's row for one NFL week scored, or unscored. */
export async function updateDfsSurvivorWeekScored(
  year: number,
  week: number,
  isScored: boolean,
) {
  return prisma.dFSSurvivorUserWeek.updateMany({
    where: { year, week },
    data: { isScored },
  });
}

export async function createDfsSurvivorWeek(
  userId: string,
  year: number,
  week: number,
) {
  return prisma.dFSSurvivorUserWeek.create({
    data: {
      userId,
      year,
      week,
      isScored: false,
    },
  });
}

/**
 * Unscored DFS Survivor picks for a year, with the week their saved game is in
 * and the picked player's team, so a pick saved against a game Sleeper later
 * dropped or moved can be pointed at the player's real game.
 */
export async function getUnscoredDfsSurvivorEntries(year: number) {
  return prisma.dFSSurvivorUserEntry.findMany({
    // Scoring marks the user's week, not each entry, so that is what to check.
    where: { year, userWeek: { isScored: false } },
    include: {
      nflGame: { select: { year: true, week: true } },
      player: { select: { currentNFLTeamId: true } },
    },
  });
}

export async function updateDfsSurvivorEntryGame(
  id: string,
  nflGameId: string,
) {
  return prisma.dFSSurvivorUserEntry.update({
    where: { id },
    data: { nflGameId },
  });
}

export async function deleteDfsSurvivorEntries(ids: string[]) {
  if (ids.length === 0) return { count: 0 };

  return prisma.dFSSurvivorUserEntry.deleteMany({
    where: { id: { in: ids } },
  });
}
