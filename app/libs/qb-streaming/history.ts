import { scoreQbStats } from './scoring';
import type { SleeperHistoricalStatsJson } from '~/libs/sleeper/schemas';
import { normalizeName } from '~/utils/names';

/**
 * Parsing and matching for the QB streaming seasons that were run in Google
 * Sheets (2020 and 2021), before the game moved onto the site. Everything here
 * is pure so the whole import can be checked against the real sheets in tests;
 * `history-import.server.ts` does the fetching and the writing.
 */

export type QbSlot = 'standard' | 'deep';

export type SheetPick = {
  /** 1-based line in the CSV. Stable across reloads, so it identifies a pick. */
  line: number;
  week: number;
  manager: string;
  qb: string;
  slot: QbSlot;
  points: number;
};

/** The sheets log the group's majority pick as a manager called CONSENSUS. */
const CONSENSUS = 'consensus';

/** Points a sheet total and a Sleeper re-score may differ by from rounding. */
export const POINTS_TOLERANCE = 0.05;

/**
 * A minimal RFC 4180 reader: quoted fields, doubled quotes, and commas and
 * newlines inside quotes. Enough for a Google Sheets CSV export, where a
 * manager name like "Smash, Criosphinx Sovereign" would split a naive reader.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

/**
 * Turns any link to a Google Sheet into its CSV export URL, keeping the tab
 * the link points at. A link with no tab gets the first one, which in both
 * QB streaming sheets is the "Data" tab.
 */
export function sheetCsvUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new Error('That is not a link.');
  }

  const id = parsed.pathname.match(/\/spreadsheets\/d\/([\w-]+)/)?.[1];
  if (parsed.hostname !== 'docs.google.com' || !id) {
    throw new Error('That is not a link to a Google Sheet.');
  }

  const gid =
    parsed.searchParams.get('gid') ??
    parsed.hash.match(/gid=(\d+)/)?.[1] ??
    '0';

  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
}

/** Each column the Data tab needs, by the heading the sheets give it. */
const REQUIRED_COLUMNS = {
  week: 'Week',
  manager: 'Player',
  qb: 'Choice',
  type: 'Type',
  points: 'Fantasy Points',
} as const;

/**
 * Reads the sheet's Data tab: one row per pick, as
 * `Week, Player, Choice, Type, Fantasy Points`. "Player" is the manager and
 * "Choice" the quarterback. CONSENSUS rows are dropped - they summarise
 * everyone else's picks rather than being anyone's entry.
 */
export function parseHistoryRows(text: string): {
  picks: SheetPick[];
  errors: string[];
} {
  const [header, ...rows] = parseCsv(text);
  const errors: string[] = [];
  const picks: SheetPick[] = [];

  const columns = (header ?? []).map(normalizeName);
  const indexOf = Object.fromEntries(
    Object.entries(REQUIRED_COLUMNS).map(([key, name]) => [
      key,
      columns.indexOf(normalizeName(name)),
    ]),
  ) as Record<keyof typeof REQUIRED_COLUMNS, number>;

  const missing = Object.entries(indexOf)
    .filter(([, index]) => index === -1)
    .map(([key]) => REQUIRED_COLUMNS[key as keyof typeof REQUIRED_COLUMNS]);
  if (missing.length > 0) {
    return {
      picks,
      errors: [
        `The sheet is missing the ${missing.join(
          ', ',
        )} column(s). Link the "Data" tab, which has Week, Player, Choice, Type and Fantasy Points.`,
      ],
    };
  }

  rows.forEach((row, index) => {
    const line = index + 2;
    const manager = (row[indexOf.manager] ?? '').trim();
    const qb = (row[indexOf.qb] ?? '').trim();

    // Blank rows at the bottom of a sheet are normal.
    if (row.every(cell => cell.trim() === '')) return;
    if (normalizeName(manager) === CONSENSUS) return;

    const week = Number(row[indexOf.week]);
    const type = normalizeName(row[indexOf.type] ?? '');
    const points = Number(row[indexOf.points]);

    if (!Number.isInteger(week) || week < 1 || week > 18) {
      errors.push(`Line ${line}: "${row[indexOf.week]}" is not a week.`);
      return;
    }
    if (type !== 'standard' && type !== 'deep') {
      errors.push(
        `Line ${line}: type "${row[indexOf.type]}" should be Standard or Deep.`,
      );
      return;
    }
    if (!manager || !normalizeName(manager)) {
      errors.push(`Line ${line}: no manager name.`);
      return;
    }
    if (!qb) {
      errors.push(`Line ${line}: no quarterback.`);
      return;
    }
    if (row[indexOf.points]?.trim() === '' || Number.isNaN(points)) {
      errors.push(`Line ${line}: "${row[indexOf.points]}" is not a score.`);
      return;
    }

    picks.push({ line, week, manager, qb, slot: type, points });
  });

  return { picks, errors };
}

export type SheetEntry = {
  week: number;
  /** Whoever the picks belong to - a member ID once matched. */
  key: string;
  /** Every spelling of the manager's name used that week. */
  managers: string[];
  standard: SheetPick[];
  deep: SheetPick[];
};

export type EntryStatus = 'ok' | 'duplicate' | 'missing';

/**
 * Groups picks into one entry per person per week. `keyOf` decides who a pick
 * belongs to, so "Apatel" and "apatel78" land in one entry once both names are
 * matched to the same member.
 */
export function groupEntries(
  picks: SheetPick[],
  keyOf: (manager: string) => string,
): SheetEntry[] {
  const entries = new Map<string, SheetEntry>();

  for (const pick of picks) {
    const key = keyOf(pick.manager);
    const id = `${pick.week}:${key}`;
    const entry = entries.get(id) ?? {
      week: pick.week,
      key,
      managers: [],
      standard: [],
      deep: [],
    };

    if (!entry.managers.includes(pick.manager)) {
      entry.managers.push(pick.manager);
    }
    entry[pick.slot].push(pick);
    entries.set(id, entry);
  }

  return [...entries.values()].sort(
    (a, b) => a.week - b.week || a.key.localeCompare(b.key),
  );
}

export function entryStatus(entry: SheetEntry): EntryStatus {
  if (entry.standard.length > 1 || entry.deep.length > 1) return 'duplicate';
  if (entry.standard.length === 0 || entry.deep.length === 0) return 'missing';
  return 'ok';
}

/** The form field an admin's choice for one slot of a duplicate is posted as. */
export const resolutionField = (entry: SheetEntry, slot: QbSlot) =>
  `pick:${entry.week}:${entry.key}:${slot}`;

/**
 * The pick that counts for each slot of an entry. A slot with one pick uses it
 * and an empty slot scores nothing; a slot with several needs `resolutions`
 * (pick line numbers keyed by `resolutionField`), and is `undefined` until the
 * admin has chosen.
 */
export function resolveEntry(
  entry: SheetEntry,
  resolutions: Record<string, string | undefined>,
): Record<QbSlot, SheetPick | null | undefined> {
  const resolveSlot = (slot: QbSlot) => {
    const picks = entry[slot];
    if (picks.length === 0) return null;
    if (picks.length === 1) return picks[0];

    const chosen = resolutions[resolutionField(entry, slot)];
    return picks.find(pick => String(pick.line) === chosen);
  };

  return { standard: resolveSlot('standard'), deep: resolveSlot('deep') };
}

export type StatRow = SleeperHistoricalStatsJson[number];

export type QbMatch = {
  sleeperId: string;
  firstName: string;
  lastName: string;
  position: string | null;
  team: string | null;
  gameId: string | null;
  /** The pick re-scored from Sleeper's stat line. */
  sleeperPoints: number;
  /**
   * An exact name match, a nickname settled by last name and points, or a
   * zero-point pick of someone who sat out and so has no stat line that week.
   */
  how: 'exact' | 'lastNameAndPoints' | 'didNotPlay';
};

const closeTo = (a: number, b: number) =>
  Math.abs(a - b) <= POINTS_TOLERANCE + 1e-9;

const toMatch = (row: StatRow, how: QbMatch['how']): QbMatch => ({
  sleeperId: row.player_id,
  firstName: row.player.first_name,
  lastName: row.player.last_name,
  position: row.player.position,
  team: row.team,
  gameId: row.game_id,
  sleeperPoints: scoreQbStats(row.stats),
  how,
});

/**
 * Finds the Sleeper player a sheet's quarterback name means, among everyone
 * with a stat line that week. The sheets were typed by hand, so "Mitch
 * Trubisky" and "CJ Beathard" have to find "Mitchell Trubisky" and
 * "C.J. Beathard": when no name matches exactly, a player whose last name
 * appears in the sheet's name and whose Sleeper score matches the sheet's
 * points is taken instead. The points make that safe - two players with one
 * surname do not score the same to the hundredth in the same week.
 */
export function matchQb(
  name: string,
  points: number,
  rows: StatRow[],
): QbMatch | { error: string } {
  const target = normalizeName(name);
  const fullName = (row: StatRow) =>
    normalizeName(`${row.player.first_name} ${row.player.last_name}`);

  const exact = rows.filter(row => fullName(row) === target);
  if (exact.length === 1) return toMatch(exact[0], 'exact');

  // Two players with one name in the same week - settle it on points.
  const pool = exact.length > 1 ? exact : rows;
  const byPoints = pool.filter(row => {
    const lastName = normalizeName(row.player.last_name);
    return (
      lastName.length > 0 &&
      target.includes(lastName) &&
      closeTo(scoreQbStats(row.stats), points)
    );
  });

  if (byPoints.length === 1) {
    return toMatch(
      byPoints[0],
      exact.length > 1 ? 'exact' : 'lastNameAndPoints',
    );
  }

  if (byPoints.length > 1) {
    return {
      error: `"${name}" matches ${byPoints
        .map(row => `${row.player.first_name} ${row.player.last_name}`)
        .join(' and ')} on name and points.`,
    };
  }

  return {
    error: `No quarterback called "${name}" scoring ${points} has a Sleeper stat line that week.`,
  };
}

/**
 * `matchQb` for a whole season's worth of stat lines. A quarterback who was
 * picked but sat out - Drew Lock in 2020 week 12, when Denver had no eligible
 * QBs - has no stat line that week, so a zero-point pick falls back to the
 * weeks he did play, taking his team from the closest one. The game is then
 * that team's game in the picked week, and is found by the caller.
 */
export function matchSeasonQb(
  name: string,
  week: number,
  points: number,
  rowsByWeek: Map<number, StatRow[]>,
): QbMatch | { error: string } {
  const match = matchQb(name, points, rowsByWeek.get(week) ?? []);
  if (!('error' in match) || !closeTo(points, 0)) return match;

  const target = normalizeName(name);
  const played = [...rowsByWeek.entries()]
    .flatMap(([rowWeek, rows]) => rows.map(row => ({ rowWeek, row })))
    .filter(({ row }) => {
      const fullName = normalizeName(
        `${row.player.first_name} ${row.player.last_name}`,
      );
      return fullName === target;
    });

  const playerIds = new Set(played.map(({ row }) => row.player_id));
  if (playerIds.size !== 1) return match;

  const closest = played.reduce((best, candidate) =>
    Math.abs(candidate.rowWeek - week) < Math.abs(best.rowWeek - week)
      ? candidate
      : best,
  );

  return {
    ...toMatch(closest.row, 'didNotPlay'),
    gameId: null,
    sleeperPoints: 0,
  };
}

export type HistoryMember = { id: string; discordName: string };

export type HistoryManager = {
  /** normalizeName of the spelling - how aliases are stored. */
  alias: string;
  /** Every spelling in the sheet that normalizes to `alias`. */
  spellings: string[];
  picks: number;
  member: HistoryMember | null;
};

export type PlannedOption = {
  sleeperId: string;
  firstName: string;
  lastName: string;
  position: string | null;
  team: string | null;
  /** Sleeper's game, or null for a player who sat out and has none. */
  gameId: string | null;
  points: number;
  isDeep: boolean;
};

export type PlannedWeek = {
  week: number;
  options: PlannedOption[];
  /** Sleeper IDs of the picks; null for a slot the member left empty. */
  selections: {
    userId: string;
    standard: string | null;
    deep: string | null;
  }[];
};

export type HistoryImport = {
  managers: HistoryManager[];
  /** Quarterbacks the sheet named that matched nothing. Blocks the import. */
  qbErrors: { week: number; qb: string; error: string }[];
  /** Quarterbacks found by nickname or from another week. Worth a glance. */
  qbNotes: {
    week: number;
    qb: string;
    matched: string;
    how: QbMatch['how'];
    team: string | null;
  }[];
  /** Picks the sheet scored differently from a Sleeper re-score. Warning only. */
  pointDiffs: {
    week: number;
    qb: string;
    sheetPoints: number;
    sleeperPoints: number;
  }[];
  /** Entries with too many or too few picks, once every name is matched. */
  entries: {
    entry: SheetEntry;
    status: Exclude<EntryStatus, 'ok'>;
    memberName: string;
    resolved: Record<QbSlot, SheetPick | null | undefined>;
  }[];
  totals: { userId: string; name: string; points: number; weeks: number }[];
  weeks: PlannedWeek[];
  /** Entries still waiting on the admin to choose between duplicate picks. */
  unresolved: number;
  /** Everything that stops the import from running, phrased for an admin. */
  blocking: string[];
};

/**
 * Works out everything an import of one sheet would write, and everything that
 * stands in its way. The admin page renders this as the preview and the import
 * writes `weeks` - one function, so what is previewed is what is imported.
 */
export function buildHistoryImport({
  picks,
  rowsByWeek,
  memberFor,
  resolutions,
}: {
  picks: SheetPick[];
  rowsByWeek: Map<number, StatRow[]>;
  memberFor: (alias: string) => HistoryMember | null;
  resolutions: Record<string, string | undefined>;
}): HistoryImport {
  const blocking: string[] = [];

  const managersByAlias = new Map<string, HistoryManager>();
  for (const pick of picks) {
    const alias = normalizeName(pick.manager);
    const manager = managersByAlias.get(alias) ?? {
      alias,
      spellings: [],
      picks: 0,
      member: memberFor(alias),
    };
    if (!manager.spellings.includes(pick.manager)) {
      manager.spellings.push(pick.manager);
    }
    manager.picks++;
    managersByAlias.set(alias, manager);
  }
  const managers = [...managersByAlias.values()].sort((a, b) =>
    a.alias.localeCompare(b.alias),
  );

  const unmatched = managers.filter(manager => !manager.member);
  if (unmatched.length > 0) {
    blocking.push(
      `${unmatched.length} sheet name${
        unmatched.length === 1 ? ' is' : 's are'
      } not matched to a member yet.`,
    );
  }

  // One lookup per quarterback per week - the sheet repeats each one for
  // everyone who picked him.
  const qbErrors: HistoryImport['qbErrors'] = [];
  const qbNotes: HistoryImport['qbNotes'] = [];
  const pointDiffs: HistoryImport['pointDiffs'] = [];
  const matches = new Map<string, QbMatch>();
  const qbKey = (week: number, qb: string) => `${week}:${normalizeName(qb)}`;

  for (const pick of picks) {
    const key = qbKey(pick.week, pick.qb);
    if (matches.has(key) || qbErrors.some(e => qbKey(e.week, e.qb) === key)) {
      continue;
    }

    const match = matchSeasonQb(pick.qb, pick.week, pick.points, rowsByWeek);
    if ('error' in match) {
      qbErrors.push({ week: pick.week, qb: pick.qb, error: match.error });
      continue;
    }

    matches.set(key, match);
    if (match.how !== 'exact') {
      qbNotes.push({
        week: pick.week,
        qb: pick.qb,
        matched: `${match.firstName} ${match.lastName}`,
        how: match.how,
        team: match.team,
      });
    }
    if (!closeTo(match.sleeperPoints, pick.points)) {
      pointDiffs.push({
        week: pick.week,
        qb: pick.qb,
        sheetPoints: pick.points,
        sleeperPoints: match.sleeperPoints,
      });
    }
  }
  if (qbErrors.length > 0) {
    blocking.push(
      `${qbErrors.length} quarterback pick${
        qbErrors.length === 1 ? '' : 's'
      } could not be matched to a Sleeper player.`,
    );
  }

  // Entries only mean anything once everyone is matched: until then "Apatel"
  // and "apatel78" look like two people with one pick each.
  const entries: HistoryImport['entries'] = [];
  const totals = new Map<string, HistoryImport['totals'][number]>();
  const weeks = new Map<number, PlannedWeek>();
  const options = new Map<string, PlannedOption>();
  let unresolved = 0;

  if (unmatched.length === 0) {
    const memberByAlias = new Map(
      managers.map(manager => [manager.alias, manager.member!]),
    );
    const grouped = groupEntries(
      picks,
      manager => memberByAlias.get(normalizeName(manager))!.id,
    );

    for (const entry of grouped) {
      const member = memberByAlias.get(normalizeName(entry.managers[0]))!;
      const status = entryStatus(entry);
      const resolved = resolveEntry(entry, resolutions);

      if (status !== 'ok') {
        entries.push({
          entry,
          status,
          memberName: member.discordName,
          resolved,
        });
      }
      if (resolved.standard === undefined || resolved.deep === undefined) {
        unresolved++;
        continue;
      }

      const total = totals.get(member.id) ?? {
        userId: member.id,
        name: member.discordName,
        points: 0,
        weeks: 0,
      };
      total.points +=
        (resolved.standard?.points ?? 0) + (resolved.deep?.points ?? 0);
      total.weeks++;
      totals.set(member.id, total);

      const plannedWeek = weeks.get(entry.week) ?? {
        week: entry.week,
        options: [],
        selections: [],
      };
      weeks.set(entry.week, plannedWeek);

      const optionFor = (pick: SheetPick | null) => {
        if (!pick) return null;
        const match = matches.get(qbKey(pick.week, pick.qb));
        if (!match) return null;

        const key = `${pick.week}:${match.sleeperId}`;
        const existing = options.get(key);
        if (existing) {
          if (!closeTo(existing.points, pick.points)) {
            blocking.push(
              `Week ${pick.week}: the sheet scores ${match.firstName} ${match.lastName} as both ${existing.points} and ${pick.points}.`,
            );
          }
          existing.isDeep ||= pick.slot === 'deep';
        } else {
          const option: PlannedOption = {
            sleeperId: match.sleeperId,
            firstName: match.firstName,
            lastName: match.lastName,
            position: match.position,
            team: match.team,
            gameId: match.gameId,
            points: pick.points,
            isDeep: pick.slot === 'deep',
          };
          options.set(key, option);
          plannedWeek.options.push(option);
        }
        return match.sleeperId;
      };

      plannedWeek.selections.push({
        userId: member.id,
        standard: optionFor(resolved.standard),
        deep: optionFor(resolved.deep),
      });
    }

    if (unresolved > 0) {
      blocking.push(
        `${unresolved} entr${
          unresolved === 1 ? 'y has' : 'ies have'
        } more than one pick in a slot - choose which one counts.`,
      );
    }
  }

  return {
    managers,
    qbErrors,
    qbNotes,
    pointDiffs,
    entries,
    totals: [...totals.values()]
      .map(total => ({
        ...total,
        points: Math.round(total.points * 100) / 100,
      }))
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name)),
    weeks: [...weeks.values()].sort((a, b) => a.week - b.week),
    unresolved,
    blocking,
  };
}
