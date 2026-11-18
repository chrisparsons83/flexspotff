import { syncSideGameWeeks } from './sync.server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as adminAlerts from '~/libs/admin-alerts.server';
import * as playerWeekScores from '~/libs/dfs-survivor/player-week-scores.server';
import * as sleeper from '~/libs/sleeper/api.server';
import * as syncs from '~/libs/syncs.server';
import * as dfsEntryModel from '~/models/dfssurvivoruserentry.server';
import * as dfsWeekModel from '~/models/dfssurvivorweek.server';
import * as locksGameModel from '~/models/locksgame.server';
import * as locksPickModel from '~/models/locksgamepicks.server';
import * as locksWeekModel from '~/models/locksweek.server';
import * as nflGameModel from '~/models/nflgame.server';
import * as poolGameModel from '~/models/poolgame.server';
import * as poolGamePickModel from '~/models/poolgamepicks.server';
import * as poolWeekModel from '~/models/poolweek.server';
import * as poolWeekMissedModel from '~/models/poolweekmissed.server';
import * as qbWeekModel from '~/models/qbstreamingweek.server';
import * as qbOptionModel from '~/models/qbstreamingweekoption.server';
import * as seasonModel from '~/models/season.server';

vi.mock('~/libs/admin-alerts.server', () => ({
  postAdminAlert: vi.fn(),
}));
vi.mock('~/libs/dfs-survivor/player-week-scores.server');
vi.mock('~/libs/sleeper/api.server');
vi.mock('~/libs/syncs.server');
vi.mock('~/models/dfssurvivoruserentry.server');
vi.mock('~/models/locksgame.server');
vi.mock('~/models/locksgamepicks.server');
vi.mock('~/models/locksweek.server');
vi.mock('~/models/nflgame.server');
vi.mock('~/models/season.server');
vi.mock('~/models/dfssurvivorweek.server');
vi.mock('~/models/poolgame.server');
vi.mock('~/models/poolgamepicks.server');
vi.mock('~/models/poolweek.server');
vi.mock('~/models/poolweekmissed.server');
vi.mock('~/models/qbstreamingweekoption.server');
vi.mock('~/models/qbstreamingweek.server');
vi.mock('~/db.server', () => ({ prisma: {} }));

// Monday 23 November 2026, 7pm Pacific - the last kickoff of NFL week 12.
const now = new Date('2026-11-24T03:00:00Z');
const week = {
  id: 'locks-week-12',
  year: 2026,
  weekNumber: 12,
  isOpen: true,
  isWeekScored: false,
  autoManaged: true,
};
const poolWeek = {
  id: 'pool-week-12',
  year: 2026,
  weekNumber: 12,
  isOpen: true,
  isWeekScored: false,
  autoManaged: true,
};
const completeGames = [
  { id: 'game-1', status: 'complete' },
  { id: 'game-2', status: 'complete' },
];
const qbWeek = {
  id: 'qb-week-12',
  year: 2026,
  week: 12,
  isOpen: true,
  isScored: false,
};
const qbOption = {
  id: 'qb-option-1',
  player: { sleeperId: 'sleeper-qb-1' },
};
const dfsWeek = {
  id: 'dfs-week-12',
  year: 2026,
  week: 12,
  isScored: false,
};
const dfsWeekWithEntries = {
  ...dfsWeek,
  entries: [
    {
      id: 'dfs-entry-1',
      player: { sleeperId: 'sleeper-rb-1', position: 'RB' },
    },
  ],
};

describe('syncSideGameWeeks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(seasonModel.getCurrentSeason).mockResolvedValue({
      year: 2026,
    } as never);
    vi.mocked(nflGameModel.getCurrentNflWeek).mockResolvedValue(12);
    vi.mocked(nflGameModel.getWeekNflGames).mockResolvedValue(
      completeGames as never,
    );
    vi.mocked(locksWeekModel.getLocksWeekByYearAndWeek).mockResolvedValue(null);
    vi.mocked(syncs.syncNflGameWeek).mockResolvedValue(true as never);
    vi.mocked(locksGameModel.getLocksGamesByYearAndWeek).mockResolvedValue([]);
    vi.mocked(poolWeekModel.getPoolWeekByYearAndWeek).mockResolvedValue(null);
    vi.mocked(poolGamePickModel.getPoolGamesPicksByPoolWeek).mockResolvedValue(
      [],
    );
    vi.mocked(poolGamePickModel.getPoolGamePicksWonLoss).mockResolvedValue([]);
    vi.mocked(poolGameModel.getPoolGamesByYearAndWeek).mockResolvedValue([]);
    vi.mocked(sleeper.getWeeklyStats).mockResolvedValue({} as never);
    vi.mocked(playerWeekScores.syncPlayerWeekScores).mockResolvedValue(
      {} as never,
    );
    vi.mocked(qbWeekModel.getQBStreamingWeekByYearAndWeek).mockResolvedValue(
      null,
    );
    vi.mocked(qbOptionModel.getQBStreamingWeekOptionsForSync).mockResolvedValue(
      [],
    );
    vi.mocked(dfsWeekModel.getDfsSurvivorWeekByYearAndWeek).mockResolvedValue(
      null,
    );
    vi.mocked(dfsWeekModel.getDfsSurvivorWeeksWithEntries).mockResolvedValue(
      [],
    );
    vi.mocked(adminAlerts.postAdminAlert).mockResolvedValue({
      status: 'posted',
      messages: 1,
    });
  });

  it('does nothing without a current season', async () => {
    vi.mocked(seasonModel.getCurrentSeason).mockResolvedValue(null);

    const report = await syncSideGameWeeks(now);

    expect(report.message).toContain('No current season');
    expect(report.scored).toEqual([]);
    expect(report.opened).toEqual([]);
    expect(nflGameModel.getCurrentNflWeek).not.toHaveBeenCalled();
    expect(syncs.syncNflGameWeek).not.toHaveBeenCalled();
    expect(adminAlerts.postAdminAlert).not.toHaveBeenCalled();
  });

  it('leaves a week alone while any of its games is still to play', async () => {
    vi.mocked(locksWeekModel.getLocksWeekByYearAndWeek).mockResolvedValue(
      week as never,
    );
    vi.mocked(nflGameModel.getWeekNflGames).mockResolvedValue([
      { id: 'game-1', status: 'complete' },
      { id: 'game-2', status: 'in_game' },
    ] as never);

    const report = await syncSideGameWeeks(now);

    expect(report.scored).toEqual([]);
    expect(locksWeekModel.updateLocksWeek).not.toHaveBeenCalled();
    expect(
      locksPickModel.updateLocksGamePicksWithResults,
    ).not.toHaveBeenCalled();
    expect(adminAlerts.postAdminAlert).not.toHaveBeenCalled();
  });

  it('scores a completed week once and posts one alert', async () => {
    const locksGame = { id: 'locks-game-1' };
    vi.mocked(locksWeekModel.getLocksWeekByYearAndWeek).mockImplementation(
      async (_year, weekNumber) => (weekNumber === 12 ? (week as never) : null),
    );
    vi.mocked(locksGameModel.getLocksGamesByYearAndWeek).mockResolvedValue([
      locksGame,
    ] as never);

    const report = await syncSideGameWeeks(now);

    expect(report.scored).toEqual([{ game: 'Locks Challenge', week: 12 }]);
    expect(syncs.syncNflGameWeek).toHaveBeenCalledWith(2026, [12], {
      removeStaleGames: false,
    });
    expect(locksPickModel.updateLocksGamePicksWithResults).toHaveBeenCalledWith(
      locksGame,
    );
    expect(locksPickModel.deleteLocksGamePicksNotActive).toHaveBeenCalledWith(
      locksGame,
    );
    expect(locksWeekModel.updateLocksWeek).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'locks-week-12',
        isWeekScored: true,
        autoManaged: true,
      }),
    );
    expect(adminAlerts.postAdminAlert).toHaveBeenCalledTimes(1);
    const alert = vi.mocked(adminAlerts.postAdminAlert).mock.calls[0][0];
    expect(alert).toContain('Locks Challenge');
    expect(alert).toContain('week 12');
    expect(alert).toContain('has been scored');
  });

  it('does not score the same week twice', async () => {
    let scored = false;
    vi.mocked(locksWeekModel.getLocksWeekByYearAndWeek).mockImplementation(
      async (_year, weekNumber) =>
        weekNumber === 12 ? ({ ...week, isWeekScored: scored } as never) : null,
    );
    vi.mocked(locksWeekModel.updateLocksWeek).mockImplementation(
      async locksWeek => {
        scored = true;
        return locksWeek as never;
      },
    );

    const first = await syncSideGameWeeks(now);
    const second = await syncSideGameWeeks(now);

    expect(first.scored).toEqual([{ game: 'Locks Challenge', week: 12 }]);
    expect(second.scored).toEqual([]);
    expect(locksWeekModel.updateLocksWeek).toHaveBeenCalledTimes(1);
    expect(adminAlerts.postAdminAlert).toHaveBeenCalledTimes(1);
  });

  it('leaves a week that is already scored alone', async () => {
    vi.mocked(locksWeekModel.getLocksWeekByYearAndWeek).mockResolvedValue({
      ...week,
      isWeekScored: true,
    } as never);

    const report = await syncSideGameWeeks(now);

    expect(report.scored).toEqual([]);
    expect(locksWeekModel.updateLocksWeek).not.toHaveBeenCalled();
    expect(adminAlerts.postAdminAlert).not.toHaveBeenCalled();
  });

  it('leaves a week an admin owns alone', async () => {
    vi.mocked(locksWeekModel.getLocksWeekByYearAndWeek).mockResolvedValue({
      ...week,
      autoManaged: false,
    } as never);

    const report = await syncSideGameWeeks(now);

    expect(report.scored).toEqual([]);
    expect(syncs.syncNflGameWeek).not.toHaveBeenCalled();
    expect(locksWeekModel.updateLocksWeek).not.toHaveBeenCalled();
    expect(adminAlerts.postAdminAlert).not.toHaveBeenCalled();
  });

  it('scores week 17 but never week 18', async () => {
    vi.mocked(nflGameModel.getCurrentNflWeek).mockResolvedValue(18);
    vi.mocked(locksWeekModel.getLocksWeekByYearAndWeek).mockImplementation(
      async (_year, weekNumber) =>
        weekNumber === 17 || weekNumber === 18
          ? ({ ...week, weekNumber } as never)
          : null,
    );

    const report = await syncSideGameWeeks(now);

    expect(report.scored).toEqual([{ game: 'Locks Challenge', week: 17 }]);
    expect(locksWeekModel.getLocksWeekByYearAndWeek).not.toHaveBeenCalledWith(
      2026,
      18,
    );
    expect(locksWeekModel.updateLocksWeek).toHaveBeenCalledTimes(1);
    expect(locksWeekModel.updateLocksWeek).toHaveBeenCalledWith(
      expect.objectContaining({ weekNumber: 17 }),
    );
  });

  it('scores a completed Spread Pool week and alerts the penalty count', async () => {
    vi.mocked(poolWeekModel.getPoolWeekByYearAndWeek).mockImplementation(
      async (_year, weekNumber) =>
        weekNumber === 12 ? (poolWeek as never) : null,
    );
    vi.mocked(poolGamePickModel.getPoolGamesPicksByPoolWeek).mockResolvedValue([
      { userId: 'user-1', amountBet: 25 },
    ] as never);
    vi.mocked(poolGamePickModel.getPoolGamePicksWonLoss).mockResolvedValue([
      { userId: 'user-1' },
      { userId: 'user-2' },
      { userId: 'user-3' },
      { userId: 'user-4' },
    ] as never);
    vi.mocked(poolGameModel.getPoolGamesByYearAndWeek).mockResolvedValue([
      { id: 'pool-game-1' },
    ] as never);

    const report = await syncSideGameWeeks(now);

    expect(report.scored).toEqual([
      {
        game: 'Spread Pool',
        week: 12,
        detail: '3 missed-week penalties written',
      },
    ]);
    expect(poolGamePickModel.getPoolGamesPicksByPoolWeek).toHaveBeenCalledWith(
      poolWeek,
    );
    expect(poolGamePickModel.getPoolGamePicksWonLoss).toHaveBeenCalledWith(
      2026,
    );
    expect(syncs.syncNflGameWeek).toHaveBeenCalledWith(2026, [12], {
      removeStaleGames: false,
    });
    expect(poolWeekMissedModel.createPoolWeekMissed).toHaveBeenCalledTimes(3);
    expect(poolWeekMissedModel.createPoolWeekMissed).toHaveBeenCalledWith(
      'user-2',
      'pool-week-12',
    );
    expect(poolWeekMissedModel.createPoolWeekMissed).toHaveBeenCalledWith(
      'user-3',
      'pool-week-12',
    );
    expect(poolWeekMissedModel.createPoolWeekMissed).toHaveBeenCalledWith(
      'user-4',
      'pool-week-12',
    );
    expect(
      poolGamePickModel.updatePoolGamePicksWithResults,
    ).toHaveBeenCalledWith({ id: 'pool-game-1' });
    expect(poolWeekModel.updatePoolWeek).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'pool-week-12',
        isWeekScored: true,
        autoManaged: true,
      }),
    );
    expect(adminAlerts.postAdminAlert).toHaveBeenCalledTimes(1);
    const alert = vi.mocked(adminAlerts.postAdminAlert).mock.calls[0][0];
    expect(alert).toContain('Spread Pool');
    expect(alert).toContain('week 12');
    expect(alert).toContain('3 missed-week penalties written');
  });

  it('writes missed-week penalties once, and a repeat run writes nothing new', async () => {
    let scored = false;
    vi.mocked(poolWeekModel.getPoolWeekByYearAndWeek).mockImplementation(
      async (_year, weekNumber) =>
        weekNumber === 12
          ? ({ ...poolWeek, isWeekScored: scored } as never)
          : null,
    );
    vi.mocked(poolWeekModel.updatePoolWeek).mockImplementation(
      async inPoolWeek => {
        scored = true;
        return inPoolWeek as never;
      },
    );
    vi.mocked(poolGamePickModel.getPoolGamesPicksByPoolWeek).mockResolvedValue([
      { userId: 'user-1', amountBet: 25 },
    ] as never);
    vi.mocked(poolGamePickModel.getPoolGamePicksWonLoss).mockResolvedValue([
      { userId: 'user-1' },
      { userId: 'user-2' },
      { userId: 'user-3' },
    ] as never);

    const first = await syncSideGameWeeks(now);
    const second = await syncSideGameWeeks(now);

    expect(first.scored).toEqual([
      {
        game: 'Spread Pool',
        week: 12,
        detail: '2 missed-week penalties written',
      },
    ]);
    expect(second.scored).toEqual([]);
    expect(poolWeekMissedModel.createPoolWeekMissed).toHaveBeenCalledTimes(2);
    expect(poolWeekModel.updatePoolWeek).toHaveBeenCalledTimes(1);
    expect(adminAlerts.postAdminAlert).toHaveBeenCalledTimes(1);
  });

  it('leaves a Spread Pool week an admin owns alone', async () => {
    vi.mocked(poolWeekModel.getPoolWeekByYearAndWeek).mockResolvedValue({
      ...poolWeek,
      autoManaged: false,
    } as never);

    const report = await syncSideGameWeeks(now);

    expect(report.scored).toEqual([]);
    expect(syncs.syncNflGameWeek).not.toHaveBeenCalled();
    expect(poolWeekMissedModel.createPoolWeekMissed).not.toHaveBeenCalled();
    expect(poolWeekModel.updatePoolWeek).not.toHaveBeenCalled();
    expect(adminAlerts.postAdminAlert).not.toHaveBeenCalled();
  });

  it('scores Locks and the Spread Pool in the same run', async () => {
    vi.mocked(locksWeekModel.getLocksWeekByYearAndWeek).mockImplementation(
      async (_year, weekNumber) => (weekNumber === 12 ? (week as never) : null),
    );
    vi.mocked(poolWeekModel.getPoolWeekByYearAndWeek).mockImplementation(
      async (_year, weekNumber) =>
        weekNumber === 12 ? (poolWeek as never) : null,
    );

    const report = await syncSideGameWeeks(now);

    expect(report.scored).toEqual([
      { game: 'Locks Challenge', week: 12 },
      {
        game: 'Spread Pool',
        week: 12,
        detail: '0 missed-week penalties written',
      },
    ]);
    expect(locksWeekModel.updateLocksWeek).toHaveBeenCalled();
    expect(poolWeekModel.updatePoolWeek).toHaveBeenCalled();
    expect(adminAlerts.postAdminAlert).toHaveBeenCalledTimes(2);
  });

  it('scores a completed QB Streaming week and alerts it', async () => {
    vi.mocked(qbWeekModel.getQBStreamingWeekByYearAndWeek).mockImplementation(
      async (_year, weekNumber) =>
        weekNumber === 12 ? (qbWeek as never) : null,
    );
    vi.mocked(qbOptionModel.getQBStreamingWeekOptionsForSync).mockResolvedValue(
      [qbOption] as never,
    );
    vi.mocked(sleeper.getWeeklyStats).mockResolvedValue({
      'sleeper-qb-1': { pass_yd: 300, pass_td: 2 },
    } as never);

    const report = await syncSideGameWeeks(now);

    expect(report.scored).toEqual([{ game: 'QB Streaming', week: 12 }]);
    expect(syncs.syncNflGameWeek).toHaveBeenCalledWith(2026, [12], {
      removeStaleGames: false,
    });
    expect(sleeper.getWeeklyStats).toHaveBeenCalledWith(2026, 12, ['QB']);
    expect(qbOptionModel.updateQBStreamingWeekOptionScore).toHaveBeenCalledWith(
      'qb-option-1',
      20,
    );
    expect(qbWeekModel.updateQBStreamingWeek).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'qb-week-12', isScored: true }),
    );
    expect(adminAlerts.postAdminAlert).toHaveBeenCalledTimes(1);
    const alert = vi.mocked(adminAlerts.postAdminAlert).mock.calls[0][0];
    expect(alert).toContain('QB Streaming');
    expect(alert).toContain('week 12');
    expect(alert).toContain('has been scored');
  });

  it('leaves a QB Streaming week alone while any of its games is still to play', async () => {
    vi.mocked(qbWeekModel.getQBStreamingWeekByYearAndWeek).mockResolvedValue(
      qbWeek as never,
    );
    vi.mocked(nflGameModel.getWeekNflGames).mockResolvedValue([
      { id: 'game-1', status: 'complete' },
      { id: 'game-2', status: 'in_game' },
    ] as never);

    const report = await syncSideGameWeeks(now);

    expect(report.scored).toEqual([]);
    expect(
      qbOptionModel.updateQBStreamingWeekOptionScore,
    ).not.toHaveBeenCalled();
    expect(qbWeekModel.updateQBStreamingWeek).not.toHaveBeenCalled();
    expect(adminAlerts.postAdminAlert).not.toHaveBeenCalled();
  });

  it('leaves a closed QB Streaming week alone, because nothing could have been entered', async () => {
    vi.mocked(qbWeekModel.getQBStreamingWeekByYearAndWeek).mockResolvedValue({
      ...qbWeek,
      isOpen: false,
    } as never);

    const report = await syncSideGameWeeks(now);

    expect(report.scored).toEqual([]);
    expect(syncs.syncNflGameWeek).not.toHaveBeenCalled();
    expect(qbWeekModel.updateQBStreamingWeek).not.toHaveBeenCalled();
    expect(adminAlerts.postAdminAlert).not.toHaveBeenCalled();
  });

  it('scores a completed DFS Survivor week and refreshes player scores', async () => {
    vi.mocked(dfsWeekModel.getDfsSurvivorWeekByYearAndWeek).mockImplementation(
      async (_year, weekNumber) =>
        weekNumber === 12 ? (dfsWeek as never) : null,
    );
    vi.mocked(dfsWeekModel.getDfsSurvivorWeeksWithEntries).mockResolvedValue([
      dfsWeekWithEntries,
    ] as never);
    vi.mocked(sleeper.getWeeklyStats).mockResolvedValue({
      'sleeper-rb-1': { rush_yd: 100, rush_td: 1 },
    } as never);

    const report = await syncSideGameWeeks(now);

    expect(report.scored).toEqual([{ game: 'DFS Survivor', week: 12 }]);
    expect(dfsEntryModel.updateDfsSurvivorEntryPoints).toHaveBeenCalledWith(
      'dfs-entry-1',
      16,
    );
    expect(dfsWeekModel.updateDfsSurvivorWeekScored).toHaveBeenCalledWith(
      2026,
      12,
      true,
    );
    expect(playerWeekScores.syncPlayerWeekScores).toHaveBeenCalledWith(
      2026,
      12,
    );
    expect(report.warnings).toEqual([]);
    expect(adminAlerts.postAdminAlert).toHaveBeenCalledTimes(1);
    const alert = vi.mocked(adminAlerts.postAdminAlert).mock.calls[0][0];
    expect(alert).toContain('DFS Survivor');
    expect(alert).toContain('week 12');
    expect(alert).toContain('has been scored');
  });

  it('leaves a DFS Survivor week alone when it has no week rows', async () => {
    const report = await syncSideGameWeeks(now);

    expect(report.scored).toEqual([]);
    expect(dfsWeekModel.getDfsSurvivorWeeksWithEntries).not.toHaveBeenCalled();
    expect(sleeper.getWeeklyStats).not.toHaveBeenCalled();
    expect(playerWeekScores.syncPlayerWeekScores).not.toHaveBeenCalled();
    expect(adminAlerts.postAdminAlert).not.toHaveBeenCalled();
  });

  it('leaves an already scored QB Streaming or DFS Survivor week alone', async () => {
    vi.mocked(qbWeekModel.getQBStreamingWeekByYearAndWeek).mockResolvedValue({
      ...qbWeek,
      isScored: true,
    } as never);
    vi.mocked(dfsWeekModel.getDfsSurvivorWeekByYearAndWeek).mockResolvedValue({
      ...dfsWeek,
      isScored: true,
    } as never);

    const report = await syncSideGameWeeks(now);

    expect(report.scored).toEqual([]);
    expect(syncs.syncNflGameWeek).not.toHaveBeenCalled();
    expect(
      qbOptionModel.updateQBStreamingWeekOptionScore,
    ).not.toHaveBeenCalled();
    expect(qbWeekModel.updateQBStreamingWeek).not.toHaveBeenCalled();
    expect(dfsWeekModel.getDfsSurvivorWeeksWithEntries).not.toHaveBeenCalled();
    expect(dfsEntryModel.updateDfsSurvivorEntryPoints).not.toHaveBeenCalled();
    expect(dfsWeekModel.updateDfsSurvivorWeekScored).not.toHaveBeenCalled();
    expect(playerWeekScores.syncPlayerWeekScores).not.toHaveBeenCalled();
    expect(adminAlerts.postAdminAlert).not.toHaveBeenCalled();
  });

  it('scores all four side games in one run', async () => {
    vi.mocked(locksWeekModel.getLocksWeekByYearAndWeek).mockImplementation(
      async (_year, weekNumber) => (weekNumber === 12 ? (week as never) : null),
    );
    vi.mocked(poolWeekModel.getPoolWeekByYearAndWeek).mockImplementation(
      async (_year, weekNumber) =>
        weekNumber === 12 ? (poolWeek as never) : null,
    );
    vi.mocked(qbWeekModel.getQBStreamingWeekByYearAndWeek).mockImplementation(
      async (_year, weekNumber) =>
        weekNumber === 12 ? (qbWeek as never) : null,
    );
    vi.mocked(dfsWeekModel.getDfsSurvivorWeekByYearAndWeek).mockImplementation(
      async (_year, weekNumber) =>
        weekNumber === 12 ? (dfsWeek as never) : null,
    );
    vi.mocked(qbOptionModel.getQBStreamingWeekOptionsForSync).mockResolvedValue(
      [qbOption] as never,
    );
    vi.mocked(dfsWeekModel.getDfsSurvivorWeeksWithEntries).mockResolvedValue([
      dfsWeekWithEntries,
    ] as never);

    const report = await syncSideGameWeeks(now);

    expect(report.scored).toEqual([
      { game: 'Locks Challenge', week: 12 },
      {
        game: 'Spread Pool',
        week: 12,
        detail: '0 missed-week penalties written',
      },
      { game: 'QB Streaming', week: 12 },
      { game: 'DFS Survivor', week: 12 },
    ]);
    expect(adminAlerts.postAdminAlert).toHaveBeenCalledTimes(4);
  });

  it('reports a failed DFS player-score refresh as a warning and keeps the week scored', async () => {
    vi.mocked(dfsWeekModel.getDfsSurvivorWeekByYearAndWeek).mockImplementation(
      async (_year, weekNumber) =>
        weekNumber === 12 ? (dfsWeek as never) : null,
    );
    vi.mocked(dfsWeekModel.getDfsSurvivorWeeksWithEntries).mockResolvedValue([
      dfsWeekWithEntries,
    ] as never);
    vi.mocked(playerWeekScores.syncPlayerWeekScores).mockRejectedValue(
      new Error('Sleeper is down'),
    );

    const report = await syncSideGameWeeks(now);

    expect(report.scored).toEqual([{ game: 'DFS Survivor', week: 12 }]);
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([
      'DFS Survivor week 12: Player score refresh failed: Sleeper is down',
    ]);
    expect(dfsWeekModel.updateDfsSurvivorWeekScored).toHaveBeenCalledWith(
      2026,
      12,
      true,
    );
    expect(adminAlerts.postAdminAlert).toHaveBeenCalledTimes(1);
  });

  it('reports a failed alert without undoing the score', async () => {
    vi.mocked(locksWeekModel.getLocksWeekByYearAndWeek).mockImplementation(
      async (_year, weekNumber) => (weekNumber === 12 ? (week as never) : null),
    );
    vi.mocked(adminAlerts.postAdminAlert).mockRejectedValue(
      new Error('Missing Access'),
    );

    const report = await syncSideGameWeeks(now);

    expect(report.scored).toEqual([{ game: 'Locks Challenge', week: 12 }]);
    expect(locksWeekModel.updateLocksWeek).toHaveBeenCalled();
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([
      'Admin alert failed for Locks Challenge week 12: Missing Access',
    ]);
  });
});
