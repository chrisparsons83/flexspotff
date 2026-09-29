import type { SheetMember, SheetName } from '~/libs/sheet-names';
import { groupSheetNames, unmatchedNamesMessage } from '~/libs/sheet-names';
import { parseCsv } from '~/utils/googleSheets';
import { namesLookAlike, normalizeName } from '~/utils/names';

/**
 * Parsing and matching for the F² seasons that were run in Google Sheets
 * (2019 to 2021), before the game moved onto the site. Everything here is pure
 * so the whole import can be checked against the real sheets in tests;
 * `history-import.server.ts` does the fetching and the writing.
 *
 * An F² entry is just the teams someone picked - its score is those teams'
 * points-for - and the leagues and teams of those years are already on the
 * site. So the import only has to work out which site team each pick means.
 * The sheets name teams by their manager's nickname, which is no use for that,
 * but their "Fantasy Team Scores" tab lists every team's weekly scores, and a
 * season of weekly scores identifies a team beyond doubt.
 */

export type SheetTeam = {
  /** 1-based line in the CSV. */
  line: number;
  name: string;
  /** The site's name for the league. */
  league: string;
  points: number;
  /** Scores by week, 1-based; weeks the sheet leaves blank are missing. */
  weeks: Map<number, number>;
};

export type SheetPick = {
  /** 1-based line in the CSV. */
  line: number;
  manager: string;
  /** The picked team, by the name the sheet gives its manager. */
  team: string;
  points: number;
  /** The 2019 sheet does not say, so its picks are placed by points alone. */
  league: string | null;
};

export type SiteTeam = {
  id: string;
  league: string;
  /** Who managed the team: their name, for the admin to eyeball, and ID. */
  owner: string | null;
  ownerId: string | null;
  pointsFor: number;
  /** Points scored by week, from the team's games. */
  weeks: Map<number, number>;
};

/**
 * Rows that are not anybody's entry: the 2021 sheet logs the group's majority
 * pick as CONSENSUS, and the 2020 sheet has the best possible entry as
 * "Perfect Lineup".
 */
const NOT_ENTRANTS = new Set(['consensus', 'perfectlineup']);

/** The 2019 sheet calls the Champions league "CL". */
const LEAGUE_NAMES: Record<string, string> = { cl: 'Champions' };

/** How far apart a sheet score and the team it means can be, from rounding. */
const SAME_POINTS = 0.005;

/**
 * Most a sheet team's weekly scores may differ from its site team's in total.
 * The sheets were scored before Sleeper's stat corrections, which moved the
 * three seasons' teams by up to 25 points; the next closest team in the same
 * league is always more than 150 away.
 */
export const MAX_WEEKLY_DIFFERENCE = 60;

/** Each column a tab needs, as the headings each year's sheet uses. */
const PICK_COLUMNS = {
  manager: ['Drafter', 'Manager'],
  team: ['Pick'],
  points: ['Points'],
} as const;

const TEAM_COLUMNS = {
  name: ['Manager', 'Player'],
  league: ['League'],
  points: ['Total Points', 'Points'],
} as const;

function findColumns<T extends Record<string, readonly string[]>>(
  header: string[],
  wanted: T,
) {
  const columns = header.map(normalizeName);
  const indexOf = {} as Record<keyof T, number>;
  const missing: string[] = [];

  for (const [key, names] of Object.entries(wanted)) {
    const index = names
      .map(name => columns.indexOf(normalizeName(name)))
      .find(found => found !== -1);
    indexOf[key as keyof T] = index ?? -1;
    if (index === undefined) missing.push(names.join(' or '));
  }

  return { indexOf, missing };
}

const leagueName = (league: string) => {
  const trimmed = league.trim();
  return LEAGUE_NAMES[normalizeName(trimmed)] ?? trimmed;
};

const isBlank = (row: string[]) => row.every(cell => cell.trim() === '');

const parsePoints = (cell: string | undefined) =>
  cell === undefined || cell.trim() === '' ? NaN : Number(cell);

/**
 * Reads the tab of picks: one row per pick, as `Drafter, Pick, Points` in 2019
 * and `Manager, Pick, Points, League` after. "Drafter" and "Manager" are the
 * entrant; "Pick" names the picked team's manager.
 */
export function parsePickRows(text: string): {
  picks: SheetPick[];
  errors: string[];
} {
  const [header = [], ...rows] = parseCsv(text);
  const picks: SheetPick[] = [];
  const errors: string[] = [];

  const { indexOf, missing } = findColumns(header, PICK_COLUMNS);
  if (missing.length > 0) {
    return {
      picks,
      errors: [
        `The picks tab is missing the ${missing.join(
          ', ',
        )} column(s). Check the tab name: it should have one row per pick, with Manager, Pick and Points.`,
      ],
    };
  }
  const leagueIndex = header.map(normalizeName).indexOf('league');

  rows.forEach((row, index) => {
    const line = index + 2;
    if (isBlank(row)) return;

    const manager = (row[indexOf.manager] ?? '').trim();
    const team = (row[indexOf.team] ?? '').trim();
    const points = parsePoints(row[indexOf.points]);
    const league =
      leagueIndex === -1 ? null : leagueName(row[leagueIndex] ?? '');

    if (NOT_ENTRANTS.has(normalizeName(manager))) return;

    if (!normalizeName(manager)) {
      errors.push(`Picks line ${line}: no manager name.`);
      return;
    }
    if (!team) {
      errors.push(`Picks line ${line}: no team picked.`);
      return;
    }
    if (Number.isNaN(points)) {
      errors.push(
        `Picks line ${line}: "${row[indexOf.points]}" is not a score.`,
      );
      return;
    }
    if (league === '') {
      errors.push(`Picks line ${line}: no league.`);
      return;
    }

    picks.push({ line, manager, team, points, league });
  });

  return { picks, errors };
}

/**
 * Reads the "Fantasy Team Scores" tab: one row per team in every league, with
 * its season total and a `Week N` column per week.
 */
export function parseTeamRows(text: string): {
  teams: SheetTeam[];
  errors: string[];
} {
  const [header = [], ...rows] = parseCsv(text);
  const teams: SheetTeam[] = [];
  const errors: string[] = [];

  const { indexOf, missing } = findColumns(header, TEAM_COLUMNS);
  const weekColumns = header.flatMap((heading, index) => {
    const week = heading.trim().match(/^Week (\d+)$/i)?.[1];
    return week ? [{ week: Number(week), index }] : [];
  });
  if (weekColumns.length === 0) missing.push('Week 1');
  if (missing.length > 0) {
    return {
      teams,
      errors: [
        `The team scores tab is missing the ${missing.join(
          ', ',
        )} column(s). Check the tab name: it should list every team with its League, Points and a column per week.`,
      ],
    };
  }

  rows.forEach((row, index) => {
    const line = index + 2;
    if (isBlank(row)) return;

    const name = (row[indexOf.name] ?? '').trim();
    const league = leagueName(row[indexOf.league] ?? '');
    const points = parsePoints(row[indexOf.points]);

    if (!name || !league) {
      errors.push(`Team scores line ${line}: no manager or league.`);
      return;
    }
    if (Number.isNaN(points)) {
      errors.push(
        `Team scores line ${line}: "${row[indexOf.points]}" is not a score.`,
      );
      return;
    }

    const weeks = new Map<number, number>();
    for (const { week, index: column } of weekColumns) {
      const score = parsePoints(row[column]);
      if (!Number.isNaN(score)) weeks.set(week, score);
    }

    teams.push({ line, name, league, points, weeks });
  });

  return { teams, errors };
}

/**
 * How far apart two teams' weekly scores are, summed over the weeks the sheet
 * has. A week the site has no game for counts as the whole sheet score, so a
 * team with no games never looks close.
 */
export function weeklyDifference(sheet: SheetTeam, site: SiteTeam): number {
  let total = 0;
  for (const [week, score] of sheet.weeks) {
    total += Math.abs(score - (site.weeks.get(week) ?? 0));
  }
  return total;
}

export type TeamMatch = {
  sheet: SheetTeam;
  site: SiteTeam;
  difference: number;
};

/**
 * Pairs each sheet team with the site team in its league whose weekly scores
 * are closest. A pairing that is not close, or two sheet teams landing on one
 * site team, means the tab is not what it should be.
 */
export function matchTeams(
  sheetTeams: SheetTeam[],
  siteTeams: SiteTeam[],
): { matches: TeamMatch[]; errors: string[] } {
  const matches: TeamMatch[] = [];
  const errors: string[] = [];

  for (const sheet of sheetTeams) {
    const [best] = siteTeams
      .filter(site => site.league === sheet.league)
      .map(site => ({ site, difference: weeklyDifference(sheet, site) }))
      .sort((a, b) => a.difference - b.difference);

    if (!best) {
      errors.push(
        `${sheet.name} is in ${sheet.league}, which is not a league on the site that year.`,
      );
    } else if (best.difference > MAX_WEEKLY_DIFFERENCE) {
      errors.push(
        `${sheet.name} (${sheet.league}) matches no site team: the closest, ${
          best.site.owner ?? 'an unowned team'
        }, is ${best.difference.toFixed(2)} points off over the season.`,
      );
    } else {
      matches.push({ sheet, ...best });
    }
  }

  const bySite = new Map<string, TeamMatch[]>();
  for (const match of matches) {
    bySite.set(match.site.id, [...(bySite.get(match.site.id) ?? []), match]);
  }
  for (const claimed of bySite.values()) {
    if (claimed.length > 1) {
      errors.push(
        `${claimed
          .map(match => match.sheet.name)
          .join(' and ')} match the same site team (${
          claimed[0].site.owner ?? 'unowned'
        }, ${claimed[0].site.league}).`,
      );
    }
  }

  return { matches, errors };
}

/**
 * Finds the sheet team a pick means. Picks carry the team's season total,
 * which is unique within a league; where two teams tied, the name settles it.
 */
export function findPickedTeam(
  pick: SheetPick,
  teams: SheetTeam[],
): SheetTeam | { error: string } {
  const byPoints = teams.filter(
    team =>
      Math.abs(team.points - pick.points) < SAME_POINTS &&
      (pick.league === null || team.league === pick.league),
  );
  const candidates =
    byPoints.length > 1
      ? byPoints.filter(
          team => normalizeName(team.name) === normalizeName(pick.team),
        )
      : byPoints;

  if (candidates.length === 1) return candidates[0];

  const where = pick.league ? ` in ${pick.league}` : '';
  return {
    error:
      candidates.length === 0
        ? `No team${where} scored ${pick.points}, the points the sheet gives ${pick.team}.`
        : `More than one team${where} is ${pick.team} with ${pick.points} points.`,
  };
}

export type PlannedEntry = {
  userId: string;
  name: string;
  /** Site team IDs, each once. */
  teamIds: string[];
  /** What the standings will show: the teams' points-for on the site. */
  sitePoints: number;
  /** What the sheet scored the entry. */
  sheetPoints: number;
};

export type HistoryImport = {
  managers: SheetName[];
  teams: TeamMatch[];
  /** Sheet teams that match no site team. */
  teamErrors: string[];
  /** Picks that match no sheet team. */
  pickErrors: { line: number; manager: string; error: string }[];
  /** Entries that break the two-per-league rule. Imported as the sheet had them. */
  entryNotes: { name: string; note: string }[];
  entries: PlannedEntry[];
  /**
   * The member each sheet name probably is, by alias, found through the team
   * they managed: most entrants also played in the leagues, and the sheet names
   * them the same way in both tabs.
   */
  ownerSuggestions: Record<string, string>;
  /** Everything that stops the import from running, phrased for an admin. */
  blocking: string[];
};

/**
 * Suggests a member for each sheet name from the teams: a name that is the
 * sheet's name for exactly one team's manager is probably that manager.
 * Several teams are fine when one person managed them all. Exact names are
 * tried first, so "FooL" is not lost to looking like "FoolsTP" as well.
 */
export function suggestOwners(
  names: SheetName[],
  teams: TeamMatch[],
): Record<string, string> {
  const suggestions: Record<string, string> = {};

  const ownerOf = (
    name: SheetName,
    same: (a: string, b: string) => boolean,
  ) => {
    const owners = new Set(
      teams
        .filter(team =>
          name.spellings.some(spelling => same(spelling, team.sheet.name)),
        )
        .map(team => team.site.ownerId),
    );
    const [owner] = owners;
    return owners.size === 1 ? owner : null;
  };
  const exactly = (a: string, b: string) =>
    normalizeName(a) !== '' && normalizeName(a) === normalizeName(b);

  for (const name of names) {
    const owner = ownerOf(name, exactly) ?? ownerOf(name, namesLookAlike);
    if (owner) suggestions[name.alias] = owner;
  }

  return suggestions;
}

const round = (points: number) => Math.round(points * 100) / 100;

/**
 * Works out everything an import of one sheet would write, and everything that
 * stands in its way. The admin page renders this as the preview and the import
 * writes `entries` - one function, so what is previewed is what is imported.
 */
export function buildHistoryImport({
  picks,
  sheetTeams,
  siteTeams,
  memberFor,
}: {
  picks: SheetPick[];
  sheetTeams: SheetTeam[];
  siteTeams: SiteTeam[];
  memberFor: (alias: string) => SheetMember | null;
}): HistoryImport {
  const blocking: string[] = [];

  const managers = groupSheetNames(
    picks.map(pick => pick.manager),
    memberFor,
  );
  const unmatchedMessage = unmatchedNamesMessage(managers);
  if (unmatchedMessage) blocking.push(unmatchedMessage);

  const { matches, errors: teamErrors } = matchTeams(sheetTeams, siteTeams);
  if (teamErrors.length > 0) {
    blocking.push(
      `${teamErrors.length} team${
        teamErrors.length === 1 ? '' : 's'
      } in the sheet could not be matched to a site team.`,
    );
  }
  const siteTeamFor = new Map(matches.map(match => [match.sheet, match.site]));

  const pickErrors: HistoryImport['pickErrors'] = [];
  const pickedTeams = new Map<SheetPick, SiteTeam>();
  for (const pick of picks) {
    const team = findPickedTeam(pick, sheetTeams);
    if ('error' in team) {
      pickErrors.push({
        line: pick.line,
        manager: pick.manager,
        error: team.error,
      });
      continue;
    }
    // A sheet team with no site team is already reported above.
    const site = siteTeamFor.get(team);
    if (site) pickedTeams.set(pick, site);
  }
  if (pickErrors.length > 0) {
    blocking.push(
      `${pickErrors.length} pick${
        pickErrors.length === 1 ? '' : 's'
      } could not be matched to a team.`,
    );
  }

  // Entries only mean anything once everyone is matched: until then two
  // spellings of one person look like two entries.
  const entryNotes: HistoryImport['entryNotes'] = [];
  const entries: PlannedEntry[] = [];

  if (!unmatchedMessage) {
    const leagues = [...new Set(siteTeams.map(team => team.league))].sort();
    const byMember = new Map<
      string,
      { member: SheetMember; aliases: Set<string>; picks: SheetPick[] }
    >();
    for (const pick of picks) {
      const alias = normalizeName(pick.manager);
      const member = managers.find(manager => manager.alias === alias)!.member!;
      const entry = byMember.get(member.id) ?? {
        member,
        aliases: new Set(),
        picks: [],
      };
      entry.aliases.add(alias);
      entry.picks.push(pick);
      byMember.set(member.id, entry);
    }

    for (const { member, aliases, picks: memberPicks } of byMember.values()) {
      const spellings = managers
        .filter(manager => aliases.has(manager.alias))
        .map(manager => manager.spellings[0]);
      // One member, one entry a year: two names on one member is most likely
      // a mistaken match, and merging their picks would hide it.
      if (aliases.size > 1) {
        blocking.push(
          `${spellings.join(' and ')} are both matched to ${
            member.discordName
          }, who can only have one entry.`,
        );
        continue;
      }

      const teams = memberPicks.flatMap(pick => {
        const team = pickedTeams.get(pick);
        return team ? [team] : [];
      });
      const unique = [...new Map(teams.map(team => [team.id, team])).values()];

      if (unique.length < teams.length) {
        entryNotes.push({
          name: member.discordName,
          note: 'Picks the same team twice; it is imported once.',
        });
      }
      const perLeague = leagues
        .map(league => ({
          league,
          count: unique.filter(team => team.league === league).length,
        }))
        .filter(({ count }) => count !== 2);
      if (perLeague.length > 0 && teams.length === memberPicks.length) {
        entryNotes.push({
          name: member.discordName,
          note: `Has ${perLeague
            .map(({ league, count }) => `${count} in ${league}`)
            .join(', ')} rather than two per league.`,
        });
      }

      entries.push({
        userId: member.id,
        name: member.discordName,
        teamIds: unique.map(team => team.id),
        sitePoints: round(
          unique.reduce((sum, team) => sum + team.pointsFor, 0),
        ),
        sheetPoints: round(
          memberPicks.reduce((sum, pick) => sum + pick.points, 0),
        ),
      });
    }
  }

  return {
    managers,
    teams: [...matches].sort(
      (a, b) =>
        a.sheet.league.localeCompare(b.sheet.league) ||
        b.difference - a.difference,
    ),
    teamErrors,
    pickErrors,
    entryNotes,
    entries: entries.sort(
      (a, b) => b.sitePoints - a.sitePoints || a.name.localeCompare(b.name),
    ),
    ownerSuggestions: suggestOwners(managers, matches),
    blocking,
  };
}
