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
// Both kicked off before Monday night, so a run at `now` has moved on to week
// 13 - which these same games represent, and which the opener therefore skips
// because its first kickoff is in the past.
const poolWeek = {
  id: 'pool-week-12',
  year: 2026,
  weekNumber: 12,
  isOpen: true,
  isWeekScored: false,
  autoManaged: true,
};
const completeGames = [
  {
    id: 'game-1',
    status: 'complete',
    gameStartTime: new Date('2026-11-22T18:00:00Z'),
  },
  {
    id: 'game-2',
    status: 'complete',
    gameStartTime: new Date('2026-11-24T01:15:00Z'),
  },
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

// A stored coming week: week 13 kicks off on Sunday 29 November 2026 and so
// opens at 8am EST on Tuesday 24 November: 13:00 UTC.
const tuesdayOpen = new Date('2026-11-24T13:00:00Z');
const week13Games = [
  {
    id: 'week-13-game-1',
    status: 'pre_game',
    gameStartTime: new Date('2026-11-29T18:00:00Z'),
  },
  {
    id: 'week-13-game-2',
    status: 'pre_game',
    gameStartTime: new Date('2026-11-30T01:15:00Z'),
  },
];

function mockOpeningWeek(weekNumber: number, games: unknown[]) {
  vi.mocked(nflGameModel.getCurrentNflWeek).mockResolvedValue(weekNumber);
  vi.mocked(nflGameModel.getWeekNflGames).mockResolvedValue(games as never);
}

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
    vi.mocked(locksWeekModel.createAndOpenLocksWeek).mockResolvedValue(
      {} as never,
    );
    vi.mocked(locksWeekModel.openLocksWeekWithGames).mockResolvedValue(
      {} as never,
    );
    vi.mocked(locksWeekModel.updateLocksWeek).mockResolvedValue({} as never);
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
    expect(locksWeekModel.createAndOpenLocksWeek).not.toHaveBeenCalled();
    expect(locksWeekModel.openLocksWeekWithGames).not.toHaveBeenCalled();
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
    // The opener still syncs the coming week, but an admin-owned week is never
    // synced for scoring.
    expect(syncs.syncNflGameWeek).not.toHaveBeenCalledWith(
      2026,
      [12],
      expect.anything(),
    );
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
      {
        id: 'game-1',
        status: 'complete',
        gameStartTime: new Date('2026-11-22T18:00:00Z'),
      },
      {
        id: 'game-2',
        status: 'in_game',
        gameStartTime: new Date('2026-11-24T01:15:00Z'),
      },
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
    expect(syncs.syncNflGameWeek).not.toHaveBeenCalledWith(2026, [12], {
      removeStaleGames: false,
    });
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
    expect(syncs.syncNflGameWeek).not.toHaveBeenCalledWith(2026, [12], {
      removeStaleGames: false,
    });
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

  describe('opening the coming week', () => {
    it('creates, links and opens the week at 8am Eastern Tuesday, with one alert', async () => {
      mockOpeningWeek(13, week13Games);

      const report = await syncSideGameWeeks(tuesdayOpen);

      expect(report.opened).toEqual([{ game: 'Locks Challenge', week: 13 }]);
      expect(syncs.syncNflGameWeek).toHaveBeenCalledWith(2026, [13]);
      expect(locksWeekModel.createAndOpenLocksWeek).toHaveBeenCalledWith(
        2026,
        13,
        ['week-13-game-1', 'week-13-game-2'],
      );
      expect(locksWeekModel.openLocksWeekWithGames).not.toHaveBeenCalled();
      expect(adminAlerts.postAdminAlert).toHaveBeenCalledTimes(1);
      const alert = vi.mocked(adminAlerts.postAdminAlert).mock.calls[0][0];
      expect(alert).toContain('Locks Challenge');
      expect(alert).toContain('week 13');
      expect(alert).toContain('has been opened');
    });

    it('opens nothing before 8am Eastern Tuesday', async () => {
      mockOpeningWeek(13, week13Games);

      const report = await syncSideGameWeeks(new Date('2026-11-24T12:59:00Z'));

      expect(report.opened).toEqual([]);
      expect(locksWeekModel.createAndOpenLocksWeek).not.toHaveBeenCalled();
      expect(adminAlerts.postAdminAlert).not.toHaveBeenCalled();
    });

    it('links and opens a closed week the automation owns', async () => {
      mockOpeningWeek(13, week13Games);
      vi.mocked(locksWeekModel.getLocksWeekByYearAndWeek).mockImplementation(
        async (_year, weekNumber) =>
          weekNumber === 13
            ? ({ ...week, weekNumber: 13, isOpen: false } as never)
            : null,
      );

      const report = await syncSideGameWeeks(tuesdayOpen);

      expect(report.opened).toEqual([{ game: 'Locks Challenge', week: 13 }]);
      expect(locksWeekModel.openLocksWeekWithGames).toHaveBeenCalledWith(
        expect.objectContaining({ weekNumber: 13, isOpen: false }),
        ['week-13-game-1', 'week-13-game-2'],
      );
      expect(locksWeekModel.createAndOpenLocksWeek).not.toHaveBeenCalled();
    });

    it('leaves an admin-owned week closed', async () => {
      mockOpeningWeek(13, week13Games);
      vi.mocked(locksWeekModel.getLocksWeekByYearAndWeek).mockImplementation(
        async (_year, weekNumber) =>
          weekNumber === 13
            ? ({
                ...week,
                weekNumber: 13,
                isOpen: false,
                autoManaged: false,
              } as never)
            : null,
      );

      const report = await syncSideGameWeeks(tuesdayOpen);

      expect(report.opened).toEqual([]);
      expect(locksWeekModel.createAndOpenLocksWeek).not.toHaveBeenCalled();
      expect(locksWeekModel.openLocksWeekWithGames).not.toHaveBeenCalled();
      expect(adminAlerts.postAdminAlert).not.toHaveBeenCalled();
    });

    it('leaves a week whose first game has already kicked off', async () => {
      mockOpeningWeek(13, [
        {
          id: 'started-game',
          status: 'in_game',
          gameStartTime: new Date('2026-11-22T18:00:00Z'),
        },
        {
          id: 'later-game',
          status: 'pre_game',
          gameStartTime: new Date('2026-11-30T01:15:00Z'),
        },
      ]);

      const report = await syncSideGameWeeks(tuesdayOpen);

      expect(report.opened).toEqual([]);
      expect(locksWeekModel.createAndOpenLocksWeek).not.toHaveBeenCalled();
      expect(adminAlerts.postAdminAlert).not.toHaveBeenCalled();
    });

    it('never opens week 18', async () => {
      mockOpeningWeek(18, [
        {
          id: 'week-18-game',
          status: 'pre_game',
          gameStartTime: new Date('2027-01-10T18:00:00Z'),
        },
      ]);

      const report = await syncSideGameWeeks(tuesdayOpen);

      expect(report.opened).toEqual([]);
      expect(nflGameModel.getWeekNflGames).not.toHaveBeenCalledWith(2026, 18);
      expect(syncs.syncNflGameWeek).not.toHaveBeenCalledWith(2026, [18]);
      expect(locksWeekModel.createAndOpenLocksWeek).not.toHaveBeenCalled();
      expect(adminAlerts.postAdminAlert).not.toHaveBeenCalled();
    });

    it('opens on the Tuesday before a Wednesday kickoff', async () => {
      mockOpeningWeek(13, [
        {
          id: 'wednesday-game',
          status: 'pre_game',
          gameStartTime: new Date('2026-11-26T01:00:00Z'),
        },
      ]);

      const report = await syncSideGameWeeks(tuesdayOpen);

      expect(report.opened).toEqual([{ game: 'Locks Challenge', week: 13 }]);
      expect(locksWeekModel.createAndOpenLocksWeek).toHaveBeenCalledWith(
        2026,
        13,
        ['wednesday-game'],
      );
    });

    it('opens at 8am Eastern on the Tuesday before the fall DST change', async () => {
      mockOpeningWeek(9, [
        {
          id: 'edt-game',
          status: 'pre_game',
          gameStartTime: new Date('2026-11-01T17:00:00Z'),
        },
      ]);

      const early = await syncSideGameWeeks(new Date('2026-10-27T11:59:00Z'));
      expect(early.opened).toEqual([]);
      expect(locksWeekModel.createAndOpenLocksWeek).not.toHaveBeenCalled();

      const onTime = await syncSideGameWeeks(new Date('2026-10-27T12:00:00Z'));
      expect(onTime.opened).toEqual([{ game: 'Locks Challenge', week: 9 }]);
    });

    it('opens at 8am Eastern on the Tuesday before the spring DST change', async () => {
      mockOpeningWeek(2, [
        {
          id: 'edt-game',
          status: 'pre_game',
          gameStartTime: new Date('2026-03-08T17:00:00Z'),
        },
      ]);

      const early = await syncSideGameWeeks(new Date('2026-03-03T12:59:00Z'));
      expect(early.opened).toEqual([]);

      const onTime = await syncSideGameWeeks(new Date('2026-03-03T13:00:00Z'));
      expect(onTime.opened).toEqual([{ game: 'Locks Challenge', week: 2 }]);
    });

    it("syncs the next week when the coming week's slate is not stored yet", async () => {
      // getCurrentNflWeek stays on the finished week 12 because the week 13
      // slate is not stored; the opener syncs week 13 itself before opening.
      vi.mocked(nflGameModel.getCurrentNflWeek).mockResolvedValue(12);
      vi.mocked(nflGameModel.getWeekNflGames).mockImplementation(
        async (_year, weekNumber) =>
          (weekNumber === 12 ? completeGames : week13Games) as never,
      );

      const report = await syncSideGameWeeks(tuesdayOpen);

      expect(syncs.syncNflGameWeek).toHaveBeenCalledWith(2026, [13]);
      expect(report.opened).toEqual([{ game: 'Locks Challenge', week: 13 }]);
    });

    it('scores the finished week before opening the next one', async () => {
      vi.mocked(nflGameModel.getCurrentNflWeek).mockResolvedValue(13);
      vi.mocked(nflGameModel.getWeekNflGames).mockImplementation(
        async (_year, weekNumber) =>
          (weekNumber === 12 ? completeGames : week13Games) as never,
      );
      vi.mocked(locksWeekModel.getLocksWeekByYearAndWeek).mockImplementation(
        async (_year, weekNumber) =>
          weekNumber === 12 ? ({ ...week, weekNumber: 12 } as never) : null,
      );

      const writes: string[] = [];
      vi.mocked(locksWeekModel.updateLocksWeek).mockImplementation(
        async locksWeek => {
          writes.push('score');
          return locksWeek as never;
        },
      );
      vi.mocked(locksWeekModel.createAndOpenLocksWeek).mockImplementation(
        async () => {
          writes.push('open');
          return {} as never;
        },
      );

      const report = await syncSideGameWeeks(tuesdayOpen);

      expect(report.scored).toEqual([{ game: 'Locks Challenge', week: 12 }]);
      expect(report.opened).toEqual([{ game: 'Locks Challenge', week: 13 }]);
      expect(writes).toEqual(['score', 'open']);
      expect(syncs.syncNflGameWeek).toHaveBeenCalledWith(2026, [12], {
        removeStaleGames: false,
      });
      expect(syncs.syncNflGameWeek).toHaveBeenCalledWith(2026, [13]);
      expect(adminAlerts.postAdminAlert).toHaveBeenCalledTimes(2);
    });

    it('reports a week that fails to open without posting an alert', async () => {
      mockOpeningWeek(13, week13Games);
      vi.mocked(locksWeekModel.createAndOpenLocksWeek).mockRejectedValue(
        new Error('transaction failed'),
      );

      const report = await syncSideGameWeeks(tuesdayOpen);

      expect(report.opened).toEqual([]);
      expect(report.errors).toEqual([
        'Locks Challenge week 13: transaction failed',
      ]);
      expect(adminAlerts.postAdminAlert).not.toHaveBeenCalled();
    });

    it('reports a failed open alert as a warning without undoing the open', async () => {
      mockOpeningWeek(13, week13Games);
      vi.mocked(adminAlerts.postAdminAlert).mockRejectedValue(
        new Error('Missing Access'),
      );

      const report = await syncSideGameWeeks(tuesdayOpen);

      expect(report.opened).toEqual([{ game: 'Locks Challenge', week: 13 }]);
      expect(report.errors).toEqual([]);
      expect(report.warnings).toEqual([
        'Admin alert failed for Locks Challenge week 13: Missing Access',
      ]);
    });
  });
});
