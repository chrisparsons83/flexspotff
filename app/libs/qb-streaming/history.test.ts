import type { SheetPick, StatRow } from './history';
import {
  buildHistoryImport,
  entryStatus,
  groupEntries,
  matchQb,
  matchSeasonQb,
  parseCsv,
  parseHistoryRows,
  resolutionField,
  sheetCsvUrl,
} from './history';
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { normalizeName } from '~/utils/names';

// The Data and leaderboard tabs of the two sheets linked from issue #155, and
// Sleeper's stat lines for those seasons trimmed to the players whose last name
// the sheets mention.
const fixture = (name: string) =>
  readFileSync(join(__dirname, '..', '__fixtures__', name), 'utf8');

const sheets = {
  2020: fixture('qb-streaming-2020-data.csv'),
  2021: fixture('qb-streaming-2021-data.csv'),
};
const leaderboards = {
  2020: fixture('qb-streaming-2020-leaderboard.csv'),
  2021: fixture('qb-streaming-2021-leaderboard.csv'),
};
const stats = JSON.parse(fixture('qb-streaming-sleeper-stats.json')) as Record<
  string,
  Record<string, StatRow[]>
>;

const rowsByWeek = (year: 2020 | 2021) =>
  new Map(
    Object.entries(stats[year]).map(([week, rows]) => [Number(week), rows]),
  );

const picksFor = (year: 2020 | 2021) => parseHistoryRows(sheets[year]).picks;

/** Every sheet name matched to a member named after its first spelling. */
const matchEveryone = (picks: SheetPick[]) => {
  const members = new Map<string, { id: string; discordName: string }>();
  for (const pick of picks) {
    const alias = normalizeName(pick.manager);
    if (!members.has(alias)) {
      members.set(alias, { id: alias, discordName: pick.manager });
    }
  }
  return (alias: string) => members.get(alias) ?? null;
};

describe('parseCsv', () => {
  it('handles quoted commas, doubled quotes and CRLF', () => {
    expect(parseCsv('a,"b, c","say ""hi"""\r\n1,2,3')).toEqual([
      ['a', 'b, c', 'say "hi"'],
      ['1', '2', '3'],
    ]);
  });

  it('keeps an empty last field', () => {
    expect(parseCsv('a,b,\n')).toEqual([['a', 'b', '']]);
  });
});

describe('sheetCsvUrl', () => {
  it('keeps the tab from the hash or the query', () => {
    expect(
      sheetCsvUrl(
        'https://docs.google.com/spreadsheets/d/abc_123/edit?gid=276913576#gid=276913576',
      ),
    ).toBe(
      'https://docs.google.com/spreadsheets/d/abc_123/export?format=csv&gid=276913576',
    );
    expect(
      sheetCsvUrl('https://docs.google.com/spreadsheets/d/abc/edit#gid=42'),
    ).toBe(
      'https://docs.google.com/spreadsheets/d/abc/export?format=csv&gid=42',
    );
  });

  it('uses the first tab when the link names none', () => {
    expect(sheetCsvUrl('https://docs.google.com/spreadsheets/d/abc')).toBe(
      'https://docs.google.com/spreadsheets/d/abc/export?format=csv&gid=0',
    );
  });

  it('rejects anything that is not a Google Sheet', () => {
    expect(() => sheetCsvUrl('not a url')).toThrow('not a link');
    expect(() => sheetCsvUrl('https://example.com/spreadsheets/d/abc')).toThrow(
      'not a link to a Google Sheet',
    );
  });
});

describe('parseHistoryRows', () => {
  it('reads every pick in both sheets and drops CONSENSUS', () => {
    const { picks: picks2020, errors: errors2020 } = parseHistoryRows(
      sheets[2020],
    );
    const { picks: picks2021, errors: errors2021 } = parseHistoryRows(
      sheets[2021],
    );

    expect(errors2020).toEqual([]);
    expect(errors2021).toEqual([]);
    expect(picks2020).toHaveLength(745);
    // 770 rows, less 34 CONSENSUS rows - which carry the only "A/B" picks.
    expect(picks2021).toHaveLength(736);
    expect(picks2021.some(pick => pick.manager === 'CONSENSUS')).toBe(false);
    expect(picks2021.some(pick => pick.qb.includes('/'))).toBe(false);
  });

  it('trims names and reads the slot', () => {
    const [pick] = parseHistoryRows(
      'Week,Player,Choice,Type,Fantasy Points\n1,Smashadams ,Sam Darnold,Deep,19.06',
    ).picks;

    expect(pick).toEqual({
      line: 2,
      week: 1,
      manager: 'Smashadams',
      qb: 'Sam Darnold',
      slot: 'deep',
      points: 19.06,
    });
  });

  it('says which column is missing when the wrong tab is linked', () => {
    const { picks, errors } = parseHistoryRows(
      'Manager,Total Points,Average Pick,Picks Entered\nBakron,573.02,17.91,32',
    );

    expect(picks).toEqual([]);
    expect(errors[0]).toMatch(
      /missing the Week, Player, Choice, Type, Fantasy Points column/,
    );
  });

  it('reports unreadable lines by line number', () => {
    const { errors } = parseHistoryRows(
      'Week,Player,Choice,Type,Fantasy Points\nx,A,B,Standard,1\n1,A,B,Shallow,1\n1,A,B,Deep,\n\n',
    );

    expect(errors).toEqual([
      'Line 2: "x" is not a week.',
      'Line 3: type "Shallow" should be Standard or Deep.',
      'Line 4: "" is not a score.',
    ]);
  });
});

describe('groupEntries', () => {
  it('finds the 2020 duplicate and the entry with a missing pick', () => {
    const picks = picksFor(2020);
    const entries = groupEntries(picks, normalizeName);
    const flagged = entries
      .filter(entry => entryStatus(entry) !== 'ok')
      .map(entry => [entry.week, entry.key, entryStatus(entry)]);

    expect(flagged).toEqual([
      [4, 'jizzmonkey69', 'missing'],
      [11, 'apatel78', 'duplicate'],
    ]);
  });

  it('merges spellings that belong to one member', () => {
    // "Apatel" and "apatel" are one manager in the 2021 sheet.
    const entries = groupEntries(picksFor(2021), normalizeName);
    const apatel = entries.find(
      entry => entry.week === 1 && entry.key === 'apatel',
    );

    expect(apatel?.managers).toEqual(['Apatel']);
    expect(entries.every(entry => entryStatus(entry) === 'ok')).toBe(true);
  });
});

describe('matchQb', () => {
  const week = (year: 2020 | 2021, number: number) => stats[year][number];

  it('matches names exactly, punctuation aside', () => {
    expect(matchQb('CJ Beathard', 19.08, week(2020, 16))).toMatchObject({
      how: 'exact',
      lastName: 'Beathard',
    });
  });

  it('settles a nickname on last name and points', () => {
    const match = matchQb('Mitch Trubisky', 18.78, week(2020, 12));

    expect(match).toMatchObject({
      how: 'lastNameAndPoints',
      firstName: 'Mitchell',
      lastName: 'Trubisky',
      team: 'CHI',
    });
  });

  it('finds Taysom Hill, whom Sleeper lists as a TE', () => {
    expect(matchQb('Taysom Hill', 24.42, week(2020, 11))).toMatchObject({
      how: 'exact',
      position: 'TE',
      team: 'NO',
      sleeperPoints: 24.22,
    });
  });

  it('refuses a name nobody in the week has', () => {
    expect(matchQb('Joe Nobody', 10, week(2020, 1))).toEqual({
      error: expect.stringContaining('Joe Nobody'),
    });
  });
});

describe('matchSeasonQb', () => {
  it('places a zero-point pick who sat out from his other weeks', () => {
    // Denver had no eligible quarterbacks in 2020 week 12.
    expect(matchSeasonQb('Drew Lock', 12, 0, rowsByWeek(2020))).toMatchObject({
      how: 'didNotPlay',
      team: 'DEN',
      gameId: null,
      sleeperPoints: 0,
    });
  });

  it('does not guess for a pick that scored', () => {
    expect(matchSeasonQb('Drew Lock', 12, 10, rowsByWeek(2020))).toEqual({
      error: expect.any(String),
    });
  });
});

describe('buildHistoryImport', () => {
  const leaderboardTotals = (year: 2020 | 2021) =>
    parseCsv(leaderboards[year])
      .slice(1)
      .filter(([name]) => name !== 'CONSENSUS')
      .map(([name, total]) => [normalizeName(name), Number(total)] as const);

  it('blocks until every name is matched', () => {
    const picks = picksFor(2021);
    const history = buildHistoryImport({
      picks,
      rowsByWeek: rowsByWeek(2021),
      memberFor: () => null,
      resolutions: {},
    });

    expect(history.blocking).toEqual([
      `${history.managers.length} sheet names are not matched to a member yet.`,
    ]);
    expect(history.weeks).toEqual([]);
  });

  it('reproduces the 2021 leaderboard', () => {
    const picks = picksFor(2021);
    const history = buildHistoryImport({
      picks,
      rowsByWeek: rowsByWeek(2021),
      memberFor: matchEveryone(picks),
      resolutions: {},
    });

    expect(history.blocking).toEqual([]);
    expect(history.qbErrors).toEqual([]);
    expect(history.weeks).toHaveLength(17);
    expect(
      history.totals.map(total => [total.userId, total.points]).sort(),
    ).toEqual(
      leaderboardTotals(2021)
        .map(([name, total]) => [name, total])
        .sort(),
    );
    expect(history.qbNotes.map(note => [note.week, note.qb, note.how])).toEqual(
      [
        [7, 'Trey Lance', 'didNotPlay'],
        [16, 'Justin Fields', 'didNotPlay'],
      ],
    );
  });

  it('reproduces the 2020 leaderboard once the duplicate is settled', () => {
    const picks = picksFor(2020);
    const memberFor = matchEveryone(picks);
    const unresolved = buildHistoryImport({
      picks,
      rowsByWeek: rowsByWeek(2020),
      memberFor,
      resolutions: {},
    });

    expect(unresolved.unresolved).toBe(1);
    expect(unresolved.blocking).toEqual([
      '1 entry has more than one pick in a slot - choose which one counts.',
    ]);

    const [duplicate] = unresolved.entries.filter(
      ({ status }) => status === 'duplicate',
    );
    const history = buildHistoryImport({
      picks,
      rowsByWeek: rowsByWeek(2020),
      memberFor,
      resolutions: {
        [resolutionField(duplicate.entry, 'standard')]: String(
          duplicate.entry.standard[0].line,
        ),
        [resolutionField(duplicate.entry, 'deep')]: String(
          duplicate.entry.deep[1].line,
        ),
      },
    });

    expect(history.blocking).toEqual([]);
    expect(history.weeks).toHaveLength(16);

    // The sheet counted all four of apatel78's week 11 picks; the site keeps
    // one per slot. Everyone else matches the sheet to the cent.
    const totals = new Map(history.totals.map(t => [t.userId, t.points]));
    for (const [name, total] of leaderboardTotals(2020)) {
      if (name === 'apatel78') {
        // Kirk Cousins (22.96) and Alex Smith (8.34) kept; Tua (7.32) and
        // Jameis Winston (0) dropped.
        expect(totals.get(name)).toBeCloseTo(total - 7.32, 2);
      } else {
        expect(totals.get(name)).toBeCloseTo(total, 2);
      }
    }

    // jizzmonkey69 only made a deep pick in week 4.
    const week4 = history.weeks.find(week => week.week === 4)!;
    expect(
      week4.selections.find(selection => selection.userId === 'jizzmonkey69'),
    ).toMatchObject({ standard: null, deep: expect.any(String) });
  });

  it('keeps one option per quarterback per week, deep if anyone took him deep', () => {
    const picks = picksFor(2021);
    const history = buildHistoryImport({
      picks,
      rowsByWeek: rowsByWeek(2021),
      memberFor: matchEveryone(picks),
      resolutions: {},
    });
    const week1 = history.weeks[0];
    const wilson = week1.options.filter(
      option => option.lastName === 'Wilson' && option.firstName === 'Zach',
    );

    // Picked as both Standard and Deep in week 1.
    expect(wilson).toHaveLength(1);
    expect(wilson[0]).toMatchObject({ isDeep: true, points: 18.32 });
  });

  it('flags scores that differ from a Sleeper re-score', () => {
    const picks = picksFor(2020);
    const history = buildHistoryImport({
      picks,
      rowsByWeek: rowsByWeek(2020),
      memberFor: matchEveryone(picks),
      resolutions: {},
    });

    expect(history.pointDiffs).toContainEqual({
      week: 11,
      qb: 'Taysom Hill',
      sheetPoints: 24.42,
      sleeperPoints: 24.22,
    });
  });
});
