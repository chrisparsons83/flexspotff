import { syncCurrentWeekScores } from './scoring.server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as d12Sync from '~/libs/d12-sync.server';
import * as syncs from '~/libs/syncs.server';
import * as d12SeasonModel from '~/models/d12season.server';
import * as nflGameModel from '~/models/nflgame.server';
import * as nflTeamModel from '~/models/nflteam.server';
import * as seasonModel from '~/models/season.server';

vi.mock('~/libs/syncs.server');
vi.mock('~/libs/d12-sync.server');
vi.mock('~/models/d12season.server');
vi.mock('~/models/nflgame.server');
vi.mock('~/models/nflteam.server');
vi.mock('~/models/season.server');
vi.mock('~/db.server', () => ({ prisma: {} }));

const setActiveGames = (count: number) =>
  vi.mocked(nflGameModel.getActiveNflGames).mockResolvedValue({
    _count: { id: count },
  } as never);

describe('syncCurrentWeekScores', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(seasonModel.getCurrentSeason).mockResolvedValue({
      year: 2026,
    } as never);
    vi.mocked(syncs.getNflState).mockResolvedValue({
      display_week: 3,
    } as never);
    vi.mocked(nflTeamModel.createNflTeams).mockResolvedValue({} as never);
    vi.mocked(syncs.syncNflGameWeek).mockResolvedValue(true as never);
    vi.mocked(syncs.syncSleeperWeeklyScores).mockResolvedValue(undefined);
    vi.mocked(d12Sync.syncD12Week).mockResolvedValue([]);
    vi.mocked(d12SeasonModel.getD12SeasonByYear).mockResolvedValue({
      id: 'season-1',
    } as never);
    setActiveGames(0);
  });

  it('bails out when there is no current season', async () => {
    vi.mocked(seasonModel.getCurrentSeason).mockResolvedValue(null);

    const report = await syncCurrentWeekScores();

    expect(report.synced).toBe(false);
    expect(syncs.syncNflGameWeek).not.toHaveBeenCalled();
  });

  it('syncs game state but leaves scores alone when no game is in progress', async () => {
    const report = await syncCurrentWeekScores();

    expect(syncs.syncNflGameWeek).toHaveBeenCalledWith(2026, [3]);
    expect(syncs.syncSleeperWeeklyScores).not.toHaveBeenCalled();
    expect(d12Sync.syncD12Week).not.toHaveBeenCalled();
    expect(report.scoresResynced).toBe(false);
    expect(report.message).toContain('left alone');
  });

  // Leagues and D12 have to move together - the whole point of one orchestrator.
  it('resyncs both league and D12 scores while games are in progress', async () => {
    setActiveGames(2);

    const report = await syncCurrentWeekScores();

    expect(syncs.syncSleeperWeeklyScores).toHaveBeenCalledWith(2026, 3);
    expect(d12Sync.syncD12Week).toHaveBeenCalledWith(2026, 3);
    expect(report.scoresResynced).toBe(true);
  });

  // An admin pressing "resync" on a quiet Tuesday means it, usually to pick up
  // a Sleeper stat correction days after the games ended.
  it('resyncs on request even with no game in progress', async () => {
    const report = await syncCurrentWeekScores({ force: true });

    expect(syncs.syncSleeperWeeklyScores).toHaveBeenCalledWith(2026, 3);
    expect(d12Sync.syncD12Week).toHaveBeenCalledWith(2026, 3);
    expect(report.scoresResynced).toBe(true);
  });

  it('skips D12 for a year that never ran the game', async () => {
    vi.mocked(d12SeasonModel.getD12SeasonByYear).mockResolvedValue(null);

    const report = await syncCurrentWeekScores({ force: true });

    expect(syncs.syncSleeperWeeklyScores).toHaveBeenCalled();
    expect(d12Sync.syncD12Week).not.toHaveBeenCalled();
    expect(report.d12Errors).toEqual([]);
  });

  it('reports D12 league failures without failing the run', async () => {
    vi.mocked(d12Sync.syncD12Week).mockResolvedValue([
      '"League A" week 3: 500',
    ]);

    const report = await syncCurrentWeekScores({ force: true });

    expect(report.synced).toBe(true);
    expect(report.d12Errors).toEqual(['"League A" week 3: 500']);
  });
});
