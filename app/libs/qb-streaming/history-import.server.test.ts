import type { StatRow } from './history';
import {
  HistoryImportError,
  NO_PICK_SLEEPER_ID,
  importQbStreamingHistory,
  previewQbStreamingHistory,
} from './history-import.server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '~/db.server';
import * as sleeperApi from '~/libs/sleeper/api.server';
import * as syncs from '~/libs/syncs.server';
import {
  createStubMemberForAlias,
  upsertMemberAlias,
} from '~/models/memberAlias.server';
import { createNflTeams } from '~/models/nflteam.server';
import { truncateDB } from '~/utils/vitest';

vi.mock('~/libs/sleeper/api.server', () => ({
  getHistoricalWeeklyStats: vi.fn(),
}));
vi.mock('~/libs/syncs.server', () => ({
  syncNflGameWeek: vi.fn(),
}));

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/test-sheet/edit';

const statRow = (
  playerId: string,
  firstName: string,
  lastName: string,
  team: string,
  gameId: string | null,
  passYards: number,
): StatRow => ({
  player_id: playerId,
  team,
  game_id: gameId,
  week: 1,
  stats: { pass_yd: passYards },
  player: { first_name: firstName, last_name: lastName, position: 'QB' },
});

// Josh Allen is on Buffalo and Tua on Miami. Russell Wilson sat out week 1,
// so he only has a stat line in week 2 and is placed by his team, Seattle.
// The importer caches a season's stats, so every test sees these same weeks.
const STATS_BY_WEEK: Record<number, StatRow[]> = {
  1: [
    statRow('allen', 'Josh', 'Allen', 'BUF', 'game-buf-mia', 300),
    statRow('tua', 'Tua', 'Tagovailoa', 'MIA', 'game-buf-mia', 200),
  ],
  2: [statRow('wilson', 'Russell', 'Wilson', 'SEA', 'game-2', 250)],
};

const sheet = (lines: string[]) =>
  ['Week,Player,Choice,Type,Fantasy Points', ...lines].join('\n');

const mockSheet = (csv: string) =>
  vi
    .spyOn(global, 'fetch')
    .mockResolvedValue(
      new Response(csv, { headers: { 'content-type': 'text/csv' } }),
    );

const makeUser = (name: string) =>
  prisma.user.create({
    data: {
      discordId: `discord-${name}`,
      discordName: name,
      discordAvatar: '',
    },
  });

const seedGames = async () => {
  await createNflTeams();
  const teams = new Map(
    (await prisma.nFLTeam.findMany()).map(team => [team.sleeperId, team.id]),
  );
  const game = (sleeperGameId: string, home: string, away: string) =>
    prisma.nFLGame.create({
      data: {
        sleeperGameId,
        status: 'complete',
        gameStartTime: new Date('2020-09-13T17:00:00Z'),
        year: 2020,
        week: 1,
        homeTeamId: teams.get(home)!,
        homeTeamScore: 20,
        awayTeamId: teams.get(away)!,
        awayTeamScore: 17,
      },
    });

  return {
    bufMia: await game('game-buf-mia', 'BUF', 'MIA'),
    // Only reachable through Seattle, since no stat line names it.
    sea: await game('game-sea', 'SEA', 'BUF'),
  };
};

describe('QB streaming history import', () => {
  beforeEach(async () => {
    await truncateDB();
    vi.mocked(sleeperApi.getHistoricalWeeklyStats).mockImplementation(
      async (_year, week) => STATS_BY_WEEK[week] ?? [],
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('refuses a year the site ran itself, before downloading anything', async () => {
    const fetchSpy = mockSheet(sheet([]));

    await expect(
      previewQbStreamingHistory({ year: 2022, sheetUrl: SHEET_URL }),
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
      previewQbStreamingHistory({ year: 2020, sheetUrl: SHEET_URL }),
    ).rejects.toThrow('anyone with the link can view it');
  });

  it('imports a season, filling an empty slot with a zero-point No pick', async () => {
    const { bufMia, sea } = await seedGames();
    const [ann, bob] = await Promise.all([makeUser('Ann'), makeUser('Bob')]);
    await upsertMemberAlias('Ann', ann.id);
    await upsertMemberAlias('bob99', bob.id);
    mockSheet(
      sheet([
        '1,Ann,Josh Allen,Standard,12.5',
        '1,Ann,Tua Tagovailoa,Deep,8',
        '1,bob99,Russell Wilson,Standard,0',
        '1,CONSENSUS,Josh Allen,Standard,12.5',
      ]),
    );

    const preview = await previewQbStreamingHistory({
      year: 2020,
      sheetUrl: SHEET_URL,
    });
    expect(preview.blocking).toEqual([]);
    // The sheet's points win over Sleeper's (300 yards is 12 points).
    expect(preview.pointDiffs).toContainEqual(
      expect.objectContaining({ qb: 'Josh Allen', sleeperPoints: 12 }),
    );

    expect(await importQbStreamingHistory(2020, preview)).toEqual({
      weeks: 1,
      options: 4,
      selections: 2,
    });
    // The games were already there, so nothing was fetched.
    expect(syncs.syncNflGameWeek).not.toHaveBeenCalled();

    const [week] = await prisma.qBStreamingWeek.findMany({
      where: { year: 2020 },
      include: {
        QBSelections: {
          include: {
            standardPlayer: { include: { player: true } },
            deepPlayer: { include: { player: true } },
          },
        },
      },
    });
    expect(week).toMatchObject({ week: 1, isOpen: false, isScored: true });

    const annPick = week.QBSelections.find(pick => pick.userId === ann.id)!;
    expect(annPick.standardPlayer).toMatchObject({
      pointsScored: 12.5,
      nflGameId: bufMia.id,
      player: { fullName: 'Josh Allen', sleeperId: 'allen' },
    });
    expect(annPick.deepPlayer).toMatchObject({ pointsScored: 8, isDeep: true });

    const bobPick = week.QBSelections.find(pick => pick.userId === bob.id)!;
    expect(bobPick.standardPlayer).toMatchObject({
      pointsScored: 0,
      nflGameId: sea.id,
      player: { fullName: 'Russell Wilson' },
    });
    expect(bobPick.deepPlayer).toMatchObject({
      pointsScored: 0,
      nflGameId: sea.id,
      player: { sleeperId: NO_PICK_SLEEPER_ID, fullName: 'No pick' },
    });

    // Re-running replaces the season rather than adding to it.
    mockSheet(
      sheet([
        '1,Ann,Josh Allen,Standard,12.5',
        '1,Ann,Tua Tagovailoa,Deep,8',
        '1,bob99,Russell Wilson,Standard,0',
      ]),
    );
    await importQbStreamingHistory(
      2020,
      await previewQbStreamingHistory({ year: 2020, sheetUrl: SHEET_URL }),
    );
    expect(await prisma.qBStreamingWeek.count()).toBe(1);
    expect(await prisma.qBSelection.count()).toBe(2);
    expect(await prisma.qBStreamingWeekOption.count()).toBe(4);
  });

  it('writes nothing while a name is unmatched', async () => {
    await seedGames();
    mockSheet(
      sheet(['1,Ann,Josh Allen,Standard,12', '1,Ann,Tua Tagovailoa,Deep,8']),
    );

    const preview = await previewQbStreamingHistory({
      year: 2020,
      sheetUrl: SHEET_URL,
    });

    expect(preview.managers).toEqual([
      expect.objectContaining({ alias: 'ann', member: null }),
    ]);
    await expect(importQbStreamingHistory(2020, preview)).rejects.toThrow(
      'not matched to a member yet',
    );
    expect(await prisma.qBStreamingWeek.count()).toBe(0);
  });

  it('explains a missing season instead of failing the game backfill', async () => {
    await createNflTeams();
    const ann = await makeUser('Ann');
    await upsertMemberAlias('Ann', ann.id);
    mockSheet(
      sheet(['1,Ann,Josh Allen,Standard,12', '1,Ann,Tua Tagovailoa,Deep,8']),
    );

    const preview = await previewQbStreamingHistory({
      year: 2020,
      sheetUrl: SHEET_URL,
    });

    await expect(importQbStreamingHistory(2020, preview)).rejects.toThrow(
      new HistoryImportError(
        "There is no 2020 season on the site, so its NFL games can't be loaded. Nothing was imported.",
      ),
    );
    expect(syncs.syncNflGameWeek).not.toHaveBeenCalled();
  });

  it('backfills the season’s games the first time', async () => {
    await createNflTeams();
    await prisma.season.create({
      data: { year: 2020, isCurrent: false, isOpenForRegistration: false },
    });
    const ann = await makeUser('Ann');
    await upsertMemberAlias('Ann', ann.id);
    mockSheet(
      sheet(['1,Ann,Josh Allen,Standard,12', '1,Ann,Tua Tagovailoa,Deep,8']),
    );
    vi.mocked(syncs.syncNflGameWeek).mockImplementation(async () => {
      await seedGamesWithoutTeams();
      return true;
    });

    const preview = await previewQbStreamingHistory({
      year: 2020,
      sheetUrl: SHEET_URL,
    });
    await importQbStreamingHistory(2020, preview);

    expect(syncs.syncNflGameWeek).toHaveBeenCalledWith(2020, [1]);
    expect(await prisma.qBSelection.count()).toBe(1);
  });
});

/** What syncNflGameWeek would leave behind, for teams that already exist. */
async function seedGamesWithoutTeams() {
  const teams = new Map(
    (await prisma.nFLTeam.findMany()).map(team => [team.sleeperId, team.id]),
  );
  await prisma.nFLGame.create({
    data: {
      sleeperGameId: 'game-buf-mia',
      status: 'complete',
      gameStartTime: new Date('2020-09-13T17:00:00Z'),
      year: 2020,
      week: 1,
      homeTeamId: teams.get('BUF')!,
      homeTeamScore: 20,
      awayTeamId: teams.get('MIA')!,
      awayTeamScore: 17,
    },
  });
}

describe('createStubMemberForAlias', () => {
  beforeEach(async () => {
    await truncateDB();
  });

  it('creates a member that can never log in and matches the name to it', async () => {
    const memberId = await createStubMemberForAlias('Tre Duce ');

    expect(await prisma.user.findUnique({ where: { id: memberId } })).toEqual(
      expect.objectContaining({
        discordId: 'legacy:treduce',
        discordName: 'Tre Duce',
      }),
    );
    expect(
      await prisma.memberAlias.findUnique({ where: { alias: 'treduce' } }),
    ).toEqual(expect.objectContaining({ userId: memberId }));
  });

  it('reuses the stub, or whoever it was merged into', async () => {
    const stubId = await createStubMemberForAlias('Tre Duce');
    expect(await createStubMemberForAlias('tre duce')).toBe(stubId);

    const real = await makeUser('TreDuce');
    await prisma.user.update({
      where: { id: stubId },
      data: { mergedIntoId: real.id, mergedAt: new Date() },
    });

    expect(await createStubMemberForAlias('Tre Duce')).toBe(real.id);
  });
});
