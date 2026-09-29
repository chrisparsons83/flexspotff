import type { SheetPick, SheetTeam, SiteTeam } from './history';
import {
  MAX_WEEKLY_DIFFERENCE,
  buildHistoryImport,
  findPickedTeam,
  matchTeams,
  parsePickRows,
  parseTeamRows,
} from './history';
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const YEARS = [2019, 2020, 2021] as const;

const fixture = (name: string) =>
  readFileSync(join(__dirname, '../__fixtures__', name), 'utf8');

// Every 2019-2021 team on the site, as exported from the database: its league,
// manager, points-for and weekly scores.
const siteTeamRows: Record<
  string,
  {
    id: string;
    league: string;
    owner: string | null;
    pointsFor: number;
    weeks: Record<string, number>;
  }[]
> = JSON.parse(fixture('f-squared-site-teams.json'));

const siteTeams = (year: number): SiteTeam[] =>
  siteTeamRows[year].map(team => ({
    ...team,
    // Stands in for the manager's member ID.
    ownerId: team.owner,
    weeks: new Map(
      Object.entries(team.weeks).map(([week, points]) => [
        Number(week),
        points,
      ]),
    ),
  }));

const sheet = (year: number) => ({
  ...parsePickRows(fixture(`f-squared-${year}-picks.csv`)),
  ...parseTeamRows(fixture(`f-squared-${year}-teams.csv`)),
});

/** Matches every name to a member of the same name. */
const everyoneMatched = (alias: string) => ({ id: alias, discordName: alias });

const sheetTeam = (overrides: Partial<SheetTeam>): SheetTeam => ({
  line: 2,
  name: 'Ann',
  league: 'Galaxy',
  points: 100,
  weeks: new Map([
    [1, 50],
    [2, 50],
  ]),
  ...overrides,
});

const siteTeam = (overrides: Partial<SiteTeam>): SiteTeam => ({
  id: 'team-ann',
  league: 'Galaxy',
  owner: 'ann',
  ownerId: 'user-ann',
  pointsFor: 100,
  weeks: new Map([
    [1, 50],
    [2, 50],
  ]),
  ...overrides,
});

const pick = (overrides: Partial<SheetPick>): SheetPick => ({
  line: 2,
  manager: 'Zed',
  team: 'Ann',
  points: 100,
  league: 'Galaxy',
  ...overrides,
});

describe('parsePickRows', () => {
  it('reads every pick in all three sheets, leaving out the non-entrants', () => {
    const counts = YEARS.map(year => {
      const { picks, errors } = sheet(year);
      expect(errors).toEqual([]);
      return picks.length;
    });

    // 21 entrants in 2019 and 39 in each of the others, with 2020's "Perfect
    // Lineup" and 2021's CONSENSUS dropped.
    expect(counts).toEqual([210, 390, 390]);
    for (const year of YEARS) {
      const managers = sheet(year).picks.map(p => p.manager.toLowerCase());
      expect(managers).not.toContain('consensus');
      expect(managers).not.toContain('perfect lineup');
    }
  });

  it('leaves the league out where the 2019 sheet does', () => {
    expect(sheet(2019).picks[0]).toEqual({
      line: 2,
      manager: 'christhrowsrocks',
      team: 'Clutch',
      points: 1410.63,
      league: null,
    });
    expect(sheet(2020).picks[0]).toMatchObject({ league: 'Champions' });
  });

  it('says which tab is wrong when the columns are missing', () => {
    const { picks, errors } = parsePickRows(
      fixture('f-squared-2020-teams.csv'),
    );

    expect(picks).toEqual([]);
    expect(errors[0]).toMatch(/^The picks tab is missing the .*Pick/);
  });

  it('reports rows it cannot read', () => {
    const { picks, errors } = parsePickRows(
      [
        'Manager,Pick,Points,League',
        'Ann,Bob,12.5,Galaxy',
        'Ann,Bob,,Galaxy',
        ',Bob,1,Galaxy',
        ',,,',
      ].join('\n'),
    );

    expect(picks).toHaveLength(1);
    expect(errors).toEqual([
      'Picks line 3: "" is not a score.',
      'Picks line 4: no manager name.',
    ]);
  });
});

describe('parseTeamRows', () => {
  it('reads all 60 teams a year, with their weekly scores', () => {
    for (const year of YEARS) {
      const { teams, errors } = sheet(year);
      expect(errors).toEqual([]);
      expect(teams).toHaveLength(60);
    }

    const [aceJiggy] = sheet(2019).teams;
    expect(aceJiggy).toMatchObject({
      name: 'AceJiggy',
      league: 'Admiral',
      points: 1576.56,
    });
    expect(aceJiggy.weeks.get(1)).toBe(141.42);
    expect(aceJiggy.weeks.size).toBe(13);
  });

  it('calls the 2019 sheet\'s "CL" by its site name, Champions', () => {
    const leagues = new Set(sheet(2019).teams.map(team => team.league));
    expect([...leagues].sort()).toEqual([
      'Admiral',
      'Champions',
      'Dragon',
      'Galaxy',
      'Monarch',
    ]);
  });

  it('says which tab is wrong when the columns are missing', () => {
    const { errors } = parseTeamRows(fixture('f-squared-2020-picks.csv'));
    expect(errors[0]).toContain('The team scores tab is missing');
  });
});

describe('matchTeams', () => {
  it('matches every sheet team to a different site team', () => {
    for (const year of YEARS) {
      const { matches, errors } = matchTeams(
        sheet(year).teams,
        siteTeams(year),
      );

      expect(errors).toEqual([]);
      expect(new Set(matches.map(match => match.site.id)).size).toBe(60);
      for (const match of matches) {
        expect(match.site.league).toBe(match.sheet.league);
        expect(match.difference).toBeLessThan(MAX_WEEKLY_DIFFERENCE);
      }
    }
  });

  it('matches a team whose scores were corrected after the sheet', () => {
    // The sheet has 2021's DUME on 1545.70; Sleeper's stat corrections took
    // the team to 1528.30.
    const { matches } = matchTeams(sheet(2021).teams, siteTeams(2021));
    const dume = matches.find(match => match.sheet.name === 'DUME')!;

    expect(dume.site).toMatchObject({ owner: 'DUME', pointsFor: 1528.3 });
  });

  it('refuses a team that is not close to any site team', () => {
    const { matches, errors } = matchTeams(
      [sheetTeam({ weeks: new Map([[1, 200]]) })],
      [siteTeam({})],
    );

    expect(matches).toEqual([]);
    expect(errors[0]).toContain('matches no site team');
  });

  it('refuses a team from a league the site does not have that year', () => {
    const { errors } = matchTeams(
      [sheetTeam({ league: 'Monarch' })],
      [siteTeam({})],
    );

    expect(errors[0]).toContain('not a league on the site');
  });

  it('refuses two sheet teams that land on one site team', () => {
    const { errors } = matchTeams(
      [sheetTeam({}), sheetTeam({ name: 'Ann again', line: 3 })],
      [siteTeam({})],
    );

    expect(errors).toEqual([
      'Ann and Ann again match the same site team (ann, Galaxy).',
    ]);
  });

  it('never matches a site team with no games', () => {
    const { errors } = matchTeams(
      [sheetTeam({})],
      [siteTeam({ weeks: new Map() })],
    );

    expect(errors[0]).toContain('100.00 points off');
  });
});

describe('findPickedTeam', () => {
  it('uses the name to settle two teams on the same points', () => {
    // 2019's Bakron (Admiral) and Eddie127 (Dragon) both finished on 1383.24,
    // and the 2019 sheet does not say which league a pick is from.
    const { teams } = sheet(2019);
    const found = (name: string) =>
      findPickedTeam(
        pick({ team: name, points: 1383.24, league: null }),
        teams,
      ) as SheetTeam;

    expect(found('Bakron').league).toBe('Admiral');
    expect(found('Eddie127').league).toBe('Dragon');
  });

  it('finds nothing when no team has the points', () => {
    expect(findPickedTeam(pick({ points: 99 }), [sheetTeam({})])).toEqual({
      error: 'No team in Galaxy scored 99, the points the sheet gives Ann.',
    });
  });

  it("only looks in the pick's league", () => {
    expect(
      findPickedTeam(pick({ league: 'Dragon' }), [sheetTeam({})]),
    ).toHaveProperty('error');
  });
});

describe('buildHistoryImport', () => {
  it('plans every entry in all three sheets, two teams from each league', () => {
    for (const year of YEARS) {
      const { picks, teams } = sheet(year);
      const history = buildHistoryImport({
        picks,
        sheetTeams: teams,
        siteTeams: siteTeams(year),
        memberFor: everyoneMatched,
      });

      expect(history.blocking).toEqual([]);
      expect(history.pickErrors).toEqual([]);
      expect(history.entryNotes).toEqual([]);
      expect(history.entries).toHaveLength(picks.length / 10);

      const leagueOf = new Map(
        siteTeams(year).map(team => [team.id, team.league]),
      );
      for (const entry of history.entries) {
        expect(entry.teamIds).toHaveLength(10);
        const perLeague = new Map<string, number>();
        for (const id of entry.teamIds) {
          const league = leagueOf.get(id)!;
          perLeague.set(league, (perLeague.get(league) ?? 0) + 1);
        }
        expect([...perLeague.values()]).toEqual([2, 2, 2, 2, 2]);
      }
    }
  });

  it('scores entries by the site teams, which agree with the sheet on every winner', () => {
    const winners = YEARS.map(year => {
      const { picks, teams } = sheet(year);
      const { entries } = buildHistoryImport({
        picks,
        sheetTeams: teams,
        siteTeams: siteTeams(year),
        memberFor: everyoneMatched,
      });

      const bySheet = [...entries].sort(
        (a, b) => b.sheetPoints - a.sheetPoints,
      );
      expect(entries[0].userId).toBe(bySheet[0].userId);
      return [entries[0].name, entries[0].sitePoints, entries[0].sheetPoints];
    });

    expect(winners).toEqual([
      ['verticle', 14239.21, 14256.71],
      ['vert', 14725.54, 14725.54],
      ['elementsoul', 15643.01, 15652.62],
    ]);
  });

  it('waits for every name to be matched before planning entries', () => {
    const { picks, teams } = sheet(2020);
    const history = buildHistoryImport({
      picks,
      sheetTeams: teams,
      siteTeams: siteTeams(2020),
      memberFor: alias => (alias === 'karan' ? null : everyoneMatched(alias)),
    });

    expect(history.blocking).toEqual([
      '1 sheet name is not matched to a member yet.',
    ]);
    expect(history.entries).toEqual([]);
  });

  it('refuses two sheet names matched to one member', () => {
    const history = buildHistoryImport({
      picks: [pick({}), pick({ manager: 'Zed2', line: 3 })],
      sheetTeams: [sheetTeam({})],
      siteTeams: [siteTeam({})],
      memberFor: () => ({ id: 'zed', discordName: 'zed' }),
    });

    expect(history.blocking).toEqual([
      'Zed and Zed2 are both matched to zed, who can only have one entry.',
    ]);
    expect(history.entries).toEqual([]);
  });

  it('flags an entry that breaks the two-per-league rule, and imports it', () => {
    const history = buildHistoryImport({
      picks: [pick({}), pick({ line: 3 })],
      sheetTeams: [sheetTeam({})],
      siteTeams: [siteTeam({})],
      memberFor: everyoneMatched,
    });

    expect(history.blocking).toEqual([]);
    expect(history.entryNotes).toEqual([
      { name: 'zed', note: 'Picks the same team twice; it is imported once.' },
      { name: 'zed', note: 'Has 1 in Galaxy rather than two per league.' },
    ]);
    expect(history.entries).toEqual([
      {
        userId: 'zed',
        name: 'zed',
        teamIds: ['team-ann'],
        sitePoints: 100,
        sheetPoints: 200,
      },
    ]);
  });

  it('suggests members from the teams they managed', () => {
    const suggestions = YEARS.map(year => {
      const { picks, teams } = sheet(year);
      return buildHistoryImport({
        picks,
        sheetTeams: teams,
        siteTeams: siteTeams(year),
        memberFor: () => null,
      }).ownerSuggestions;
    });

    // Names that look nothing like the member's Discord name.
    expect(suggestions[0]).toMatchObject({
      jad: 'slimarabia',
      jomhatesjulio: 'Jom',
    });
    expect(suggestions[1]).toMatchObject({
      tc216997: 'Tee Cee',
      elementsoul: 'Fire Jerry into the Sun',
      // FooL and FoolsTP each look like both, so the exact name decides.
      fool: 'pixelatedfool',
      foolstp: 'foolstp',
    });
    expect(suggestions[2]).toMatchObject({ hlve: '. Jeremy' });

    // 2019's moose#0017 managed no team that year.
    expect(suggestions[0]).not.toHaveProperty('moose0017');
    const names = YEARS.map(
      year => new Set(sheet(year).picks.map(p => p.manager)).size,
    );
    expect(suggestions.map(year => Object.keys(year).length)).toEqual([
      names[0] - 1,
      names[1],
      names[2],
    ]);
  });

  it('suggests no one when a name looks like two managers', () => {
    const history = buildHistoryImport({
      picks: [pick({ manager: 'Ann' })],
      sheetTeams: [
        sheetTeam({}),
        sheetTeam({
          name: 'Annie',
          line: 3,
          points: 90,
          weeks: new Map([[1, 90]]),
        }),
      ],
      siteTeams: [
        siteTeam({}),
        siteTeam({
          id: 'team-annie',
          ownerId: 'user-annie',
          pointsFor: 90,
          weeks: new Map([[1, 90]]),
        }),
      ],
      memberFor: () => null,
    });

    // "Ann" is Ann's team exactly, so Annie's does not muddy it.
    expect(history.ownerSuggestions).toEqual({ ann: 'user-ann' });
  });

  it('blocks on a pick that matches no team', () => {
    const history = buildHistoryImport({
      picks: [pick({ points: 5 })],
      sheetTeams: [sheetTeam({})],
      siteTeams: [siteTeam({})],
      memberFor: everyoneMatched,
    });

    expect(history.blocking).toEqual([
      '1 pick could not be matched to a team.',
    ]);
    expect(history.pickErrors).toHaveLength(1);
  });
});
