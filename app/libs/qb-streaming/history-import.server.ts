import type { HistoryImport, StatRow } from './history';
import { buildHistoryImport, parseHistoryRows, sheetCsvUrl } from './history';
import { randomUUID } from 'node:crypto';
import { prisma } from '~/db.server';
import { getHistoricalWeeklyStats } from '~/libs/sleeper/api.server';
import { syncNflGameWeek } from '~/libs/syncs.server';
import { getMemberAliases } from '~/models/memberAlias.server';
import { getNflGamesBySeason } from '~/models/nflgame.server';
import { getSeason } from '~/models/season.server';

/**
 * QB streaming ran on the site from 2022. Anything from then on was played
 * here, and an import deletes the year it writes, so those years are off
 * limits.
 */
export const FIRST_SITE_QB_STREAMING_YEAR = 2022;

/** Stands in for the empty slot of an entry that only made one pick. */
export const NO_PICK_SLEEPER_ID = 'NO_PICK';

/** Regular season weeks, counting the 18th that began in 2021. */
const SEASON_WEEKS = Array.from({ length: 18 }, (_, i) => i + 1);

// A finished season's stats never change, so each one is fetched once per
// process rather than 18 requests on every reload of the preview.
const seasonStatsCache = new Map<number, Promise<Map<number, StatRow[]>>>();

function getSeasonStats(year: number) {
  let cached = seasonStatsCache.get(year);
  if (!cached) {
    cached = Promise.all(
      SEASON_WEEKS.map(
        async week =>
          [week, await getHistoricalWeeklyStats(year, week)] as const,
      ),
    ).then(weeks => new Map(weeks));
    // A failed fetch should be retried on the next load, not remembered.
    cached.catch(() => seasonStatsCache.delete(year));
    seasonStatsCache.set(year, cached);
  }
  return cached;
}

export class HistoryImportError extends Error {}

async function fetchSheet(sheetUrl: string) {
  let csvUrl: string;
  try {
    csvUrl = sheetCsvUrl(sheetUrl);
  } catch (error) {
    throw new HistoryImportError((error as Error).message);
  }

  const res = await fetch(csvUrl);
  // A private sheet redirects to a Google sign-in page rather than failing.
  const isCsv = res.headers.get('content-type')?.includes('text/csv');
  if (!res.ok || !isCsv) {
    throw new HistoryImportError(
      `Could not download the sheet (${res.status}). Check that anyone with the link can view it.`,
    );
  }

  return res.text();
}

export type HistoryPreview = HistoryImport & { parseErrors: string[] };

/**
 * Downloads the sheet and Sleeper's stats for the season and works out the
 * import, using whatever name matches have been saved so far.
 */
export async function previewQbStreamingHistory({
  year,
  sheetUrl,
  resolutions = {},
}: {
  year: number;
  sheetUrl: string;
  resolutions?: Record<string, string | undefined>;
}): Promise<HistoryPreview> {
  if (year >= FIRST_SITE_QB_STREAMING_YEAR) {
    throw new HistoryImportError(
      `QB streaming was run on the site from ${FIRST_SITE_QB_STREAMING_YEAR}, so ${year} cannot be imported from a sheet.`,
    );
  }

  const csv = await fetchSheet(sheetUrl);
  const { picks, errors: parseErrors } = parseHistoryRows(csv);
  if (picks.length === 0) {
    throw new HistoryImportError(
      parseErrors[0] ?? 'The sheet has no picks in it.',
    );
  }

  const [rowsByWeek, aliases] = await Promise.all([
    getSeasonStats(year),
    getMemberAliases(picks.map(pick => pick.manager)),
  ]);

  const history = buildHistoryImport({
    picks,
    rowsByWeek,
    memberFor: alias => aliases.get(alias) ?? null,
    resolutions,
  });

  if (parseErrors.length > 0) {
    history.blocking.unshift(
      `${parseErrors.length} line${
        parseErrors.length === 1 ? '' : 's'
      } of the sheet could not be read.`,
    );
  }

  return { ...history, parseErrors };
}

/**
 * Finds the NFL game each planned pick was played in, backfilling the season's
 * games from Sleeper the first time a year is imported.
 */
async function resolveGames(year: number, weeks: number[]) {
  const loadedWeeks = new Set(
    (await getNflGamesBySeason(year)).map(game => game.week),
  );
  const missingWeeks = weeks.filter(week => !loadedWeeks.has(week));
  if (missingWeeks.length > 0) {
    // syncNflGameWeek needs the year's Season row, and says so with a plain
    // Error that would reach the admin as a 500.
    if (!(await getSeason(year))) {
      throw new HistoryImportError(
        `There is no ${year} season on the site, so its NFL games can't be loaded. Nothing was imported.`,
      );
    }
    await syncNflGameWeek(year, missingWeeks);
  }

  const games = await getNflGamesBySeason(year);
  const bySleeperId = new Map(games.map(game => [game.sleeperGameId, game.id]));
  const byTeamWeek = new Map(
    games.flatMap(game => [
      [`${game.week}:${game.homeTeam.sleeperId}`, game.id],
      [`${game.week}:${game.awayTeam.sleeperId}`, game.id],
    ]),
  );

  return (week: number, gameId: string | null, team: string | null) =>
    (gameId && bySleeperId.get(gameId)) ||
    (team && byTeamWeek.get(`${week}:${team}`)) ||
    null;
}

/**
 * Writes a previewed season. The year's existing weeks are deleted first -
 * options and selections cascade with them - so an import can be re-run after
 * fixing a match, and always leaves exactly what the preview showed.
 */
export async function importQbStreamingHistory(
  year: number,
  history: HistoryPreview,
) {
  if (year >= FIRST_SITE_QB_STREAMING_YEAR) {
    throw new HistoryImportError(
      `${year} was run on the site and cannot be overwritten from a sheet.`,
    );
  }
  if (history.blocking.length > 0) {
    throw new HistoryImportError(
      `Nothing was imported: ${history.blocking.join(' ')}`,
    );
  }

  const gameFor = await resolveGames(
    year,
    history.weeks.map(week => week.week),
  );

  // Every player the sheet picked, including retired ones Sleeper's player list
  // may no longer carry. Existing rows are left alone.
  const plannedPlayers = new Map(
    history.weeks.flatMap(week =>
      week.options.map(option => [option.sleeperId, option] as const),
    ),
  );
  await prisma.player.createMany({
    data: [...plannedPlayers.values()].map(option => ({
      sleeperId: option.sleeperId,
      firstName: option.firstName,
      lastName: option.lastName,
      fullName: `${option.firstName} ${option.lastName}`,
      position: option.position,
    })),
    skipDuplicates: true,
  });
  const noPickPlayer = await prisma.player.upsert({
    where: { sleeperId: NO_PICK_SLEEPER_ID },
    update: {},
    create: {
      sleeperId: NO_PICK_SLEEPER_ID,
      firstName: 'No',
      lastName: 'pick',
      fullName: 'No pick',
    },
  });
  const players = await prisma.player.findMany({
    where: { sleeperId: { in: [...plannedPlayers.keys()] } },
    select: { id: true, sleeperId: true },
  });
  const playerIdBySleeperId = new Map(
    players.map(player => [player.sleeperId, player.id]),
  );

  const weekRows = [];
  const optionRows = [];
  const selectionRows = [];

  for (const plannedWeek of history.weeks) {
    const weekId = randomUUID();
    weekRows.push({
      id: weekId,
      year,
      week: plannedWeek.week,
      isOpen: false,
      // Scored weeks are what the standings and title badges count.
      isScored: true,
    });

    const optionIdBySleeperId = new Map<string, string>();
    const gameIdBySleeperId = new Map<string, string>();
    for (const option of plannedWeek.options) {
      const nflGameId = gameFor(plannedWeek.week, option.gameId, option.team);
      if (!nflGameId) {
        throw new HistoryImportError(
          `Week ${plannedWeek.week}: no NFL game found for ${option.firstName} ${option.lastName} (${option.team}). Nothing was imported.`,
        );
      }

      const id = randomUUID();
      optionIdBySleeperId.set(option.sleeperId, id);
      gameIdBySleeperId.set(option.sleeperId, nflGameId);
      optionRows.push({
        id,
        qbStreamingWeekId: weekId,
        playerId: playerIdBySleeperId.get(option.sleeperId)!,
        nflGameId,
        isDeep: option.isDeep,
        pointsScored: option.points,
      });
    }

    // One zero-point option per week covers every empty slot in it. It needs
    // some game to hang off, so it borrows the other pick's.
    let noPickOptionId: string | null = null;
    const optionOrNoPick = (sleeperId: string | null, other: string) => {
      if (sleeperId) return optionIdBySleeperId.get(sleeperId)!;
      if (!noPickOptionId) {
        noPickOptionId = randomUUID();
        optionRows.push({
          id: noPickOptionId,
          qbStreamingWeekId: weekId,
          playerId: noPickPlayer.id,
          nflGameId: gameIdBySleeperId.get(other)!,
          isDeep: false,
          pointsScored: 0,
        });
      }
      return noPickOptionId;
    };

    for (const selection of plannedWeek.selections) {
      selectionRows.push({
        id: randomUUID(),
        qbStreamingWeekId: weekId,
        userId: selection.userId,
        standardPlayerId: optionOrNoPick(
          selection.standard,
          selection.deep ?? '',
        ),
        deepPlayerId: optionOrNoPick(selection.deep, selection.standard ?? ''),
      });
    }
  }

  await prisma.$transaction([
    prisma.qBStreamingWeek.deleteMany({ where: { year } }),
    prisma.qBStreamingWeek.createMany({ data: weekRows }),
    prisma.qBStreamingWeekOption.createMany({ data: optionRows }),
    prisma.qBSelection.createMany({ data: selectionRows }),
  ]);

  return {
    weeks: weekRows.length,
    options: optionRows.length,
    selections: selectionRows.length,
  };
}
