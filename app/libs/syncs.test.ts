import { syncAdp, syncNflGameWeek } from './syncs.server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as sleeperApi from '~/libs/sleeper/api.server';
import * as draftPickModel from '~/models/draftpick.server';
import type { League } from '~/models/league.server';
import * as leagueModel from '~/models/league.server';
import * as nflGameModel from '~/models/nflgame.server';
import * as nflTeamModel from '~/models/nflteam.server';
import * as playerModel from '~/models/players.server';
import * as poolGameModel from '~/models/poolgame.server';
import * as seasonModel from '~/models/season.server';
import * as seasonWeekModel from '~/models/seasonWeek.server';
import * as teamModel from '~/models/team.server';

vi.mock('~/models/draftpick.server');
vi.mock('~/models/league.server');
vi.mock('~/models/players.server');
vi.mock('~/models/team.server');
vi.mock('~/libs/sleeper/api.server');
vi.mock('~/models/nflgame.server');
vi.mock('~/models/nflteam.server');
vi.mock('~/models/poolgame.server');
vi.mock('~/models/season.server');
vi.mock('~/models/seasonWeek.server');
vi.mock('~/db.server', () => ({
  prisma: {},
}));

describe('syncAdp', () => {
  const realFetch = globalThis.fetch;

  const league = {
    id: 'league-1',
    name: 'Champions',
    year: 2024,
    sleeperLeagueId: 'sleeper-league-1',
    sleeperDraftId: 'sleeper-draft-1',
    isDrafted: false,
    isActive: true,
    tier: 1,
    draftDateTime: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  } as League;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(draftPickModel.getDraftPicks).mockResolvedValue(null as never);
    vi.mocked(playerModel.getPlayers).mockResolvedValue([] as never);
    vi.mocked(teamModel.getTeams).mockResolvedValue([] as never);
    vi.mocked(leagueModel.updateLeague).mockResolvedValue({} as never);
    vi.mocked(sleeperApi.getDraftPicksWithOwners).mockResolvedValue([]);

    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => [],
    })) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  // syncLeague writes the draft date it pulled from Sleeper and then calls
  // syncAdp with the league object it was handed, which still holds the old
  // date. Writing the whole object back here used to undo that write, so an
  // undrafted league never picked up its draft time.
  it('only writes isDrafted, leaving the rest of the league row alone', async () => {
    await syncAdp(league);

    expect(leagueModel.updateLeague).toHaveBeenCalledWith({
      id: 'league-1',
      isDrafted: false,
    });
  });
});

describe('syncNflGameWeek', () => {
  const sleeperGame = (gameId: string, week: number) => ({
    game_id: gameId,
    week,
    status: 'pre_game',
    metadata: {
      home_team: 'SEA',
      away_team: 'SF',
      date_time: '2026-10-18T20:05:00Z',
    },
  });

  const storedGame = (id: string, sleeperGameId: string) =>
    ({ id, sleeperGameId } as never);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(seasonModel.getSeason).mockResolvedValue({ id: 's' } as never);
    vi.mocked(seasonWeekModel.getSeasonWeeksBySeason).mockResolvedValue([
      {},
    ] as never);
    vi.mocked(nflTeamModel.getNflTeams).mockResolvedValue([
      { id: 'sea', sleeperId: 'SEA' },
      { id: 'sf', sleeperId: 'SF' },
    ] as never);
    vi.mocked(nflGameModel.upsertNflGame).mockResolvedValue({} as never);
    vi.mocked(nflGameModel.deleteUnreferencedNflGames).mockResolvedValue({
      count: 0,
    });
    vi.mocked(poolGameModel.getPoolGamesByNflGameIds).mockResolvedValue([]);
    vi.mocked(poolGameModel.getPoolGamesOutsideTheirWeek).mockResolvedValue([]);
  });

  it('removes a game Sleeper no longer lists, and its spread pool game', async () => {
    vi.mocked(sleeperApi.getNflScores).mockResolvedValue({
      scores: [sleeperGame('real', 6)],
    });
    vi.mocked(nflGameModel.getWeekNflGames).mockResolvedValue([
      storedGame('game-real', 'real'),
      storedGame('game-extra', 'extra'),
    ] as never);
    vi.mocked(poolGameModel.getPoolGamesByNflGameIds).mockResolvedValue([
      { id: 'pool-extra' },
    ] as never);

    await syncNflGameWeek(2026, [6]);

    expect(poolGameModel.getPoolGamesByNflGameIds).toHaveBeenCalledWith([
      'game-extra',
    ]);
    expect(poolGameModel.deletePoolGamesWithPicks).toHaveBeenCalledWith([
      'pool-extra',
    ]);
    expect(nflGameModel.deleteUnreferencedNflGames).toHaveBeenCalledWith([
      'game-extra',
    ]);
  });

  it('removes a spread pool game whose NFL game moved to another week', async () => {
    vi.mocked(sleeperApi.getNflScores).mockResolvedValue({
      scores: [sleeperGame('real', 6)],
    });
    vi.mocked(nflGameModel.getWeekNflGames).mockResolvedValue([
      storedGame('game-real', 'real'),
    ] as never);
    vi.mocked(poolGameModel.getPoolGamesOutsideTheirWeek).mockResolvedValue([
      { id: 'pool-moved' },
    ] as never);

    await syncNflGameWeek(2026, [6]);

    expect(poolGameModel.deletePoolGamesWithPicks).toHaveBeenCalledWith([
      'pool-moved',
    ]);
    expect(nflGameModel.deleteUnreferencedNflGames).toHaveBeenCalledWith([]);
  });

  it('leaves a week alone when Sleeper returns no games for it', async () => {
    vi.mocked(sleeperApi.getNflScores).mockResolvedValue({ scores: [] });

    await syncNflGameWeek(2026, [6]);

    expect(nflGameModel.getWeekNflGames).not.toHaveBeenCalled();
    expect(nflGameModel.deleteUnreferencedNflGames).toHaveBeenCalledWith([]);
  });
});
