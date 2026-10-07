import {
  HistoryImportError,
  importFSquaredHistory,
  previewFSquaredHistory,
} from './history-import.server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '~/db.server';
import { getStandingsForYear } from '~/models/fsquared.server';
import {
  createStubMemberForAlias,
  upsertMemberAlias,
} from '~/models/memberAlias.server';
import { truncateDB } from '~/utils/vitest';

const SOURCE = {
  sheetUrl: 'https://docs.google.com/spreadsheets/d/test-sheet/edit',
  picksTab: 'Picks',
  teamsTab: 'Fantasy Team Scores',
};

const TEAMS_TAB = [
  'Manager,League,Total Points,Week 1,Week 2',
  // Sleeper later corrected Ann's week 2 by a point.
  'Ann,Galaxy,100,60,40',
  'Bob,Galaxy,80,30,50',
];

const csv = (lines: string[]) =>
  new Response(lines.join('\n'), { headers: { 'content-type': 'text/csv' } });

/** Answers each tab's download with its own CSV, by the tab named in the URL. */
const mockSheet = (picks: string[], teams = TEAMS_TAB) =>
  vi.spyOn(global, 'fetch').mockImplementation(async input => {
    const url = String(input);
    if (url.includes('sheet=Picks'))
      return csv(['Manager,Pick,Points', ...picks]);
    if (url.includes('sheet=Fantasy%20Team%20Scores')) return csv(teams);
    throw new Error(`Unexpected fetch of ${url}`);
  });

const makeUser = (name: string) =>
  prisma.user.create({
    data: {
      discordId: `discord-${name}`,
      handle: `discord-${name}`,
      discordName: name,
      discordAvatar: '',
    },
  });

/** A 2020 Galaxy league with Ann's and Bob's teams and their weekly games. */
const seedLeague = async () => {
  const league = await prisma.league.create({
    data: {
      year: 2020,
      name: 'Galaxy',
      sleeperLeagueId: 'league-galaxy',
      sleeperDraftId: 'draft-galaxy',
      tier: 2,
      isActive: false,
      isDrafted: true,
    },
  });

  const team = async (rosterId: number, pointsFor: number, weeks: number[]) =>
    prisma.team.create({
      data: {
        leagueId: league.id,
        rosterId,
        sleeperOwnerId: `owner-${rosterId}`,
        wins: 1,
        losses: 1,
        ties: 0,
        pointsFor,
        pointsAgainst: 90,
        TeamGames: {
          create: weeks.map((pointsScored, index) => ({
            week: index + 1,
            sleeperMatchupId: 1,
            pointsScored,
          })),
        },
      },
    });

  return {
    ann: await team(1, 101, [60, 41]),
    bob: await team(2, 80, [30, 50]),
  };
};

describe('F² history import', () => {
  beforeEach(async () => {
    await truncateDB();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('refuses a year the site ran itself, before downloading anything', async () => {
    const fetchSpy = mockSheet([]);

    await expect(
      previewFSquaredHistory({ year: 2022, ...SOURCE }),
    ).rejects.toThrow(HistoryImportError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('says so when the sheet is private', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('<html>Sign in</html>', {
        headers: { 'content-type': 'text/html' },
      }),
    );

    await expect(
      previewFSquaredHistory({ year: 2020, ...SOURCE }),
    ).rejects.toThrow('anyone with the link can view it');
  });

  it('says so when the year has no leagues on the site', async () => {
    mockSheet(['Zed,Ann,100']);

    await expect(
      previewFSquaredHistory({ year: 2020, ...SOURCE }),
    ).rejects.toThrow('There are no 2020 leagues on the site');
  });

  it('says so when a tab name points at the wrong tab', async () => {
    await seedLeague();
    // An unknown tab name gets the sheet's first tab back, not an error.
    mockSheet(['Zed,Ann,100'], ['Drafter,Pick,Points', 'Zed,Ann,100']);

    await expect(
      previewFSquaredHistory({ year: 2020, ...SOURCE }),
    ).rejects.toThrow('The team scores tab is missing');
  });

  it('imports a season, scoring entries by the site teams', async () => {
    const { ann, bob } = await seedLeague();
    const zed = await makeUser('Zed');
    await upsertMemberAlias('Zed', zed.id);
    const yan = await createStubMemberForAlias('Yan');
    mockSheet(['Zed,Ann,100', 'Zed,Bob,80', 'Yan,Bob,80', 'CONSENSUS,Ann,100']);

    const preview = await previewFSquaredHistory({ year: 2020, ...SOURCE });
    expect(preview.blocking).toEqual([]);
    expect(preview.teams.map(match => match.site.id)).toEqual([ann.id, bob.id]);

    expect(await importFSquaredHistory(2020, preview)).toEqual({ entries: 2 });

    const standings = await getStandingsForYear(2020);
    expect(standings.map(entry => [entry.user.id, entry.totalPoints])).toEqual([
      // Ann's team counts its corrected 101, not the sheet's 100.
      [zed.id, 181],
      [yan, 80],
    ]);

    // Re-running replaces the season rather than adding to it.
    mockSheet(['Zed,Ann,100']);
    const again = await previewFSquaredHistory({ year: 2020, ...SOURCE });
    await importFSquaredHistory(2020, again);

    const entries = await prisma.fSquaredEntry.findMany({
      include: { teams: true },
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ userId: zed.id, year: 2020 });
    expect(entries[0].teams.map(team => team.id)).toEqual([ann.id]);
  });

  it('leaves other years alone', async () => {
    await seedLeague();
    const zed = await makeUser('Zed');
    await upsertMemberAlias('Zed', zed.id);
    await prisma.fSquaredEntry.create({ data: { year: 2021, userId: zed.id } });
    mockSheet(['Zed,Ann,100']);

    await importFSquaredHistory(
      2020,
      await previewFSquaredHistory({ year: 2020, ...SOURCE }),
    );

    expect(await prisma.fSquaredEntry.count({ where: { year: 2021 } })).toBe(1);
  });

  it('suggests the member who managed a team the sheet names the same', async () => {
    const { ann } = await seedLeague();
    const annMember = await makeUser('ann_the_manager');
    await prisma.team.update({
      where: { id: ann.id },
      data: { userId: annMember.id },
    });
    mockSheet(['Ann,Bob,80']);

    const preview = await previewFSquaredHistory({ year: 2020, ...SOURCE });

    expect(preview.ownerSuggestions).toEqual({ ann: annMember.id });
  });

  it('imports nothing while a name is unmatched', async () => {
    await seedLeague();
    mockSheet(['Zed,Ann,100']);

    const preview = await previewFSquaredHistory({ year: 2020, ...SOURCE });
    expect(preview.managers).toEqual([
      { alias: 'zed', spellings: ['Zed'], picks: 1, member: null },
    ]);

    await expect(importFSquaredHistory(2020, preview)).rejects.toThrow(
      'Nothing was imported: 1 sheet name is not matched to a member yet.',
    );
    expect(await prisma.fSquaredEntry.count()).toBe(0);
  });
});
