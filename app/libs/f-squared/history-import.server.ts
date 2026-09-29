import type { HistoryImport, SiteTeam } from './history';
import { buildHistoryImport, parsePickRows, parseTeamRows } from './history';
import { prisma } from '~/db.server';
import { getMemberAliases } from '~/models/memberAlias.server';
import {
  SheetDownloadError,
  downloadSheetCsv,
  sheetTabCsvUrl,
} from '~/utils/googleSheets';

/**
 * F² ran on the site from 2022. Anything from then on was played here, and an
 * import deletes the year it writes, so those years are off limits.
 */
export const FIRST_SITE_F_SQUARED_YEAR = 2022;

export class HistoryImportError extends Error {}

async function fetchTab(sheetUrl: string, tab: string) {
  let csvUrl: string;
  try {
    csvUrl = sheetTabCsvUrl(sheetUrl, tab);
  } catch (error) {
    throw new HistoryImportError((error as Error).message);
  }

  try {
    return await downloadSheetCsv(csvUrl);
  } catch (error) {
    if (error instanceof SheetDownloadError) {
      throw new HistoryImportError(error.message);
    }
    throw error;
  }
}

/** Every team in the year's leagues, with the weekly scores to match on. */
async function getSiteTeams(year: number): Promise<SiteTeam[]> {
  const teams = await prisma.team.findMany({
    where: { league: { year } },
    select: {
      id: true,
      pointsFor: true,
      league: { select: { name: true } },
      user: { select: { id: true, discordName: true } },
      TeamGames: { select: { week: true, pointsScored: true } },
    },
  });

  return teams.map(team => ({
    id: team.id,
    league: team.league.name,
    owner: team.user?.discordName ?? null,
    ownerId: team.user?.id ?? null,
    pointsFor: team.pointsFor,
    weeks: new Map(team.TeamGames.map(game => [game.week, game.pointsScored])),
  }));
}

export type HistoryPreview = HistoryImport & { parseErrors: string[] };

/**
 * Downloads the sheet's picks and team scores and works out the import, using
 * whatever name matches have been saved so far.
 */
export async function previewFSquaredHistory({
  year,
  sheetUrl,
  picksTab,
  teamsTab,
}: {
  year: number;
  sheetUrl: string;
  picksTab: string;
  teamsTab: string;
}): Promise<HistoryPreview> {
  if (year >= FIRST_SITE_F_SQUARED_YEAR) {
    throw new HistoryImportError(
      `F² was run on the site from ${FIRST_SITE_F_SQUARED_YEAR}, so ${year} cannot be imported from a sheet.`,
    );
  }

  const [picksCsv, teamsCsv, siteTeams] = await Promise.all([
    fetchTab(sheetUrl, picksTab),
    fetchTab(sheetUrl, teamsTab),
    getSiteTeams(year),
  ]);

  const { picks, errors: pickParseErrors } = parsePickRows(picksCsv);
  if (picks.length === 0) {
    throw new HistoryImportError(
      pickParseErrors[0] ?? 'The picks tab has no picks in it.',
    );
  }
  const { teams: sheetTeams, errors: teamParseErrors } =
    parseTeamRows(teamsCsv);
  if (sheetTeams.length === 0) {
    throw new HistoryImportError(
      teamParseErrors[0] ?? 'The team scores tab has no teams in it.',
    );
  }
  if (siteTeams.length === 0) {
    throw new HistoryImportError(
      `There are no ${year} leagues on the site, so the picks have no teams to point at.`,
    );
  }

  const aliases = await getMemberAliases(picks.map(pick => pick.manager));
  const history = buildHistoryImport({
    picks,
    sheetTeams,
    siteTeams,
    memberFor: alias => aliases.get(alias) ?? null,
  });

  const parseErrors = [...pickParseErrors, ...teamParseErrors];
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
 * Writes a previewed season. The year's existing entries are deleted first, so
 * an import can be re-run after fixing a match, and always leaves exactly what
 * the preview showed.
 */
export async function importFSquaredHistory(
  year: number,
  history: HistoryPreview,
) {
  if (year >= FIRST_SITE_F_SQUARED_YEAR) {
    throw new HistoryImportError(
      `${year} was run on the site and cannot be overwritten from a sheet.`,
    );
  }
  if (history.blocking.length > 0) {
    throw new HistoryImportError(
      `Nothing was imported: ${history.blocking.join(' ')}`,
    );
  }

  await prisma.$transaction([
    prisma.fSquaredEntry.deleteMany({ where: { year } }),
    ...history.entries.map(entry =>
      prisma.fSquaredEntry.create({
        data: {
          year,
          userId: entry.userId,
          teams: { connect: entry.teamIds.map(id => ({ id })) },
        },
      }),
    ),
  ]);

  return { entries: history.entries.length };
}
