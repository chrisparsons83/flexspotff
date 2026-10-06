import {
  buildDfsCareer,
  buildDfsFinishes,
  buildDfsPool,
  buildDfsPositions,
  buildDfsSeasons,
  buildDfsWeeks,
  type DfsEntryRow,
  type DfsPlayer,
} from './dfsSurvivorProfile';
import { prisma } from '~/db.server';
import { getCurrentSeason } from '~/models/season.server';

/**
 * Only entries in scored weeks. An open week's lineups are hidden on the
 * standings page until kickoff, and a profile is no place to leak them.
 *
 * The week rows themselves are no use for telling who played: a member's
 * season is created with all seventeen at once, so a week with no entries is
 * a week they skipped. The season row's stored `points` is not used either -
 * it drifts from the entries, and the standings page sums the entries too.
 */
const scoredEntry = { userWeek: { isScored: true } } as const;

/**
 * Everything the DFS Survivor tab shows.
 *
 * The whole field is loaded for the seasons the member played, because every
 * number on the tab is measured against it: the week's rank, each pick against
 * the field's pick in that slot, and each player against the other members
 * who spent him in another week.
 */
export async function getDfsSurvivorProfile(userId: string) {
  const entered = await prisma.dFSSurvivorUserEntry.findMany({
    where: { userId, ...scoredEntry },
    select: { year: true },
    distinct: ['year'],
  });
  const years = entered.map(row => row.year);
  if (years.length === 0) return { hasPlayed: false as const };

  const [entries, currentSeason, memberPlayers] = await Promise.all([
    prisma.dFSSurvivorUserEntry.findMany({
      where: { year: { in: years }, ...scoredEntry },
      select: {
        userId: true,
        year: true,
        week: true,
        position: true,
        playerId: true,
        points: true,
      },
    }),
    getCurrentSeason(),
    // Only the member's own players are named on the tab.
    prisma.player.findMany({
      where: { dfsSurvivorEntries: { some: { userId, ...scoredEntry } } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        fullName: true,
        position: true,
      },
    }),
  ]);

  const rows: DfsEntryRow[] = entries.map(entry => ({
    userId: entry.userId,
    year: entry.year,
    week: entry.week,
    slot: entry.position,
    playerId: entry.playerId,
    points: entry.points,
  }));

  const players = new Map<string, DfsPlayer>(
    memberPlayers.map(player => [
      player.id,
      {
        name: player.fullName,
        // A defense is filed as city and mascot, and the mascot alone is
        // what a short name needs: "Bengals", not "C. Bengals".
        shortName:
          player.position === 'DEF'
            ? player.lastName
            : `${player.firstName.charAt(0)}. ${player.lastName}`,
        position: player.position,
      },
    ]),
  );

  const weeks = buildDfsWeeks(rows, userId, players);
  const seasons = buildDfsSeasons({
    weeks,
    rows,
    finishes: buildDfsFinishes(rows, userId),
    inProgressYear: currentSeason?.year ?? null,
  });

  return {
    hasPlayed: true as const,
    career: buildDfsCareer(seasons),
    seasons,
    pool: buildDfsPool(seasons, rows, userId),
    positions: buildDfsPositions(weeks),
  };
}
