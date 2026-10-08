import {
  buildBestAvailable,
  buildQbCareer,
  buildQbExposure,
  buildQbFinishes,
  buildQbSeasons,
  buildQbWeeks,
  type QbPlayer,
  type QbSelectionRow,
} from './qbStreamingProfile';
import { prisma } from '~/db.server';
import { NO_PICK_SLEEPER_ID } from '~/libs/qb-streaming/history-import.server';
import { getInProgressYear } from '~/models/seasonState.server';

/**
 * Everything the QB Streaming tab shows.
 *
 * Only scored weeks are read. An open week's picks are hidden on the standings
 * page until kickoff, and a profile is no place to leak them - besides, a week
 * of zeros would drag every average down until Tuesday.
 *
 * The whole field is loaded for the seasons the member played, because every
 * number on the tab is measured against it: the week's rank, the pick's margin
 * over the average pick, and the season finish.
 */
export async function getQbStreamingProfile(userId: string) {
  const entered = await prisma.qBSelection.findMany({
    where: { userId, qbStreamingWeek: { isScored: true } },
    select: { qbStreamingWeek: { select: { year: true } } },
  });
  const years = Array.from(
    new Set(entered.map(row => row.qbStreamingWeek.year)),
  );
  if (years.length === 0) return { hasPlayed: false as const };

  const [selections, options, inProgressYear] = await Promise.all([
    prisma.qBSelection.findMany({
      where: { qbStreamingWeek: { year: { in: years }, isScored: true } },
      select: {
        userId: true,
        qbStreamingWeek: { select: { year: true, week: true } },
        standardPlayer: { select: { playerId: true, pointsScored: true } },
        deepPlayer: { select: { playerId: true, pointsScored: true } },
      },
    }),
    // Every QB on each week's list, not just the ones picked, so a pick can
    // be measured against the best it could have been.
    prisma.qBStreamingWeekOption.findMany({
      where: {
        qbStreamingWeek: { year: { in: years }, isScored: true },
        player: { sleeperId: { not: NO_PICK_SLEEPER_ID } },
      },
      select: {
        isDeep: true,
        pointsScored: true,
        qbStreamingWeek: { select: { year: true, week: true } },
      },
    }),
    getInProgressYear(),
  ]);

  const rows: QbSelectionRow[] = selections.map(selection => ({
    userId: selection.userId,
    year: selection.qbStreamingWeek.year,
    week: selection.qbStreamingWeek.week,
    standard: {
      playerId: selection.standardPlayer.playerId,
      points: selection.standardPlayer.pointsScored,
    },
    deep: {
      playerId: selection.deepPlayer.playerId,
      points: selection.deepPlayer.pointsScored,
    },
  }));

  const mine = rows.filter(row => row.userId === userId);
  const players = new Map<string, QbPlayer>(
    (
      await prisma.player.findMany({
        where: {
          id: {
            in: Array.from(
              new Set(
                mine.flatMap(row => [row.standard.playerId, row.deep.playerId]),
              ),
            ),
          },
        },
        select: { id: true, firstName: true, lastName: true, sleeperId: true },
      })
    ).map(player => [
      player.id,
      {
        firstName: player.firstName,
        lastName: player.lastName,
        noPick: player.sleeperId === NO_PICK_SLEEPER_ID,
      },
    ]),
  );

  const weeks = buildQbWeeks(
    rows,
    userId,
    players,
    buildBestAvailable(
      options.map(option => ({
        year: option.qbStreamingWeek.year,
        week: option.qbStreamingWeek.week,
        isDeep: option.isDeep,
        points: option.pointsScored,
      })),
    ),
  );
  const seasons = buildQbSeasons({
    weeks,
    finishes: buildQbFinishes(rows, userId),
    inProgressYear,
  });

  return {
    hasPlayed: true as const,
    career: buildQbCareer(seasons),
    seasons,
    exposure: buildQbExposure(weeks),
  };
}
