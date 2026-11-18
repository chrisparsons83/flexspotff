import { syncSideGameWeeks } from './sync.server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as adminAlerts from '~/libs/admin-alerts.server';
import * as syncs from '~/libs/syncs.server';
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
import * as seasonModel from '~/models/season.server';

vi.mock('~/libs/admin-alerts.server', () => ({
  postAdminAlert: vi.fn(),
}));
vi.mock('~/libs/syncs.server');
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

// A stored coming week: week 13 kicks off on Sunday 29 November 2026 and so
// opens at 8am EST on Tuesday 24 November: 13:00 UTC.
const tuesdayOpen = new Date('2026-11-24T13:00:00Z');
const week13Games = [
  {
    id: 'week-13-game-1',
    status: 'pre_game',
    gameStartTime: new Date('2026-11-29T18:00:00Z'),
    homeTeam: { name: 'Kansas City Chiefs' },
    awayTeam: { name: 'Buffalo Bills' },
  },
  {
    id: 'week-13-game-2',
    status: 'pre_game',
    gameStartTime: new Date('2026-11-30T01:15:00Z'),
    homeTeam: { name: 'San Francisco 49ers' },
    awayTeam: { name: 'Seattle Seahawks' },
  },
];

// The Odds API answers with one game per matchup; DraftKings carries the line
// for each team, keyed by the team name the pool page pre-fills from.
function oddsFor(
  games: { home: string; away: string }[],
  { draftkings = true } = {},
) {
  return games.map(({ home, away }, index) => ({
    id: `odds-${index}`,
    sport_key: 'americanfootball_nfl',
    sport_title: 'NFL',
    commence_time: '2026-11-29T18:00:00Z',
    home_team: home,
    away_team: away,
    bookmakers: draftkings
      ? [
          {
            key: 'draftkings',
            title: 'DraftKings',
            last_update: '2026-11-24T13:00:00Z',
            markets: [
              {
                key: 'spreads',
                outcomes: [
                  { name: home, price: -110, point: -3.5 },
                  { name: away, price: -110, point: 3.5 },
                ],
              },
            ],
          },
        ]
      : [],
  }));
}

const week13Odds = oddsFor([
  { home: 'Kansas City Chiefs', away: 'Buffalo Bills' },
  { home: 'San Francisco 49ers', away: 'Seattle Seahawks' },
]);

const realFetch = globalThis.fetch;
const realSpreadsApiKey = process.env.SPREADS_API_KEY;

function mockOpeningWeek(weekNumber: number, games: unknown[]) {
  vi.mocked(nflGameModel.getCurrentNflWeek).mockResolvedValue(weekNumber);
  vi.mocked(nflGameModel.getWeekNflGames).mockResolvedValue(games as never);
}

describe('syncSideGameWeeks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SPREADS_API_KEY = 'test-key';
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => week13Odds,
    })) as unknown as typeof fetch;
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
    // The Locks-opening tests start with the coming pool week already open,
    // so the pool's own opener skips; the pool-opening tests override this.
    vi.mocked(poolWeekModel.getPoolWeekByYearAndWeek).mockImplementation(
      async (_year, weekNumber) =>
        weekNumber === 13
          ? ({ ...poolWeek, weekNumber: 13, isOpen: true } as never)
          : null,
    );
    vi.mocked(poolGamePickModel.getPoolGamesPicksByPoolWeek).mockResolvedValue(
      [],
    );
    vi.mocked(poolGamePickModel.getPoolGamePicksWonLoss).mockResolvedValue([]);
    vi.mocked(poolGameModel.getPoolGamesByYearAndWeek).mockResolvedValue([]);
    vi.mocked(adminAlerts.postAdminAlert).mockResolvedValue({
      status: 'posted',
      messages: 1,
    });
  });

  afterEach(() => {
    if (realSpreadsApiKey === undefined) delete process.env.SPREADS_API_KEY;
    else process.env.SPREADS_API_KEY = realSpreadsApiKey;
    globalThis.fetch = realFetch;
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

  it('leaves QB Streaming and DFS Survivor untouched', async () => {
    vi.mocked(locksWeekModel.getLocksWeekByYearAndWeek).mockImplementation(
      async (_year, weekNumber) => (weekNumber === 12 ? (week as never) : null),
    );

    const report = await syncSideGameWeeks(now);

    expect(report.scored).toEqual([{ game: 'Locks Challenge', week: 12 }]);
    expect(qbWeekModel.getQBStreamingWeekByYearAndWeek).not.toHaveBeenCalled();
    expect(qbWeekModel.updateQBStreamingWeek).not.toHaveBeenCalled();
    expect(dfsWeekModel.getDfsSurvivorWeekByYearAndWeek).not.toHaveBeenCalled();
    expect(dfsWeekModel.updateDfsSurvivorEntryGame).not.toHaveBeenCalled();
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

  describe('opening the Spread Pool', () => {
    it('opens the week when every game has a line, writing every line', async () => {
      mockOpeningWeek(13, week13Games);
      vi.mocked(poolWeekModel.getPoolWeekByYearAndWeek).mockResolvedValue(null);

      const report = await syncSideGameWeeks(tuesdayOpen);

      expect(report.opened).toEqual([
        { game: 'Locks Challenge', week: 13 },
        { game: 'Spread Pool', week: 13, detail: '2 games have lines' },
      ]);
      expect(poolWeekModel.createAndOpenPoolWeek).toHaveBeenCalledWith(
        2026,
        13,
        [
          { gameId: 'week-13-game-1', homeSpread: -3.5 },
          { gameId: 'week-13-game-2', homeSpread: -3.5 },
        ],
      );
      expect(poolWeekModel.writeClosedPoolWeekLines).not.toHaveBeenCalled();
      expect(poolWeekModel.openPoolWeekWithLines).not.toHaveBeenCalled();
      expect(report.warnings).toEqual([]);
      expect(adminAlerts.postAdminAlert).toHaveBeenCalledTimes(2);
      const poolAlert = vi
        .mocked(adminAlerts.postAdminAlert)
        .mock.calls.find(([message]) => message.includes('Spread Pool'))?.[0];
      expect(poolAlert).toContain('Spread Pool');
      expect(poolAlert).toContain('week 13');
      expect(poolAlert).toContain('has been opened');
      expect(poolAlert).toContain('2 games have lines');
    });

    it('leaves the week closed while writing the lines it has, alerting once', async () => {
      mockOpeningWeek(13, week13Games);
      vi.mocked(poolWeekModel.getPoolWeekByYearAndWeek).mockResolvedValue(null);
      const closedWeek = {
        ...poolWeek,
        weekNumber: 13,
        isOpen: false,
        openAlertedAt: null,
      };
      vi.mocked(poolWeekModel.createClosedPoolWeekWithLines).mockResolvedValue(
        closedWeek as never,
      );
      // Only the first matchup has a DraftKings line.
      globalThis.fetch = vi.fn(async () => ({
        ok: true,
        json: async () => [week13Odds[0]],
      })) as unknown as typeof fetch;

      const report = await syncSideGameWeeks(tuesdayOpen);

      expect(report.opened).toEqual([{ game: 'Locks Challenge', week: 13 }]);
      expect(report.errors).toEqual([]);
      expect(poolWeekModel.createClosedPoolWeekWithLines).toHaveBeenCalledWith(
        2026,
        13,
        [{ gameId: 'week-13-game-1', homeSpread: -3.5 }],
      );
      expect(poolWeekModel.createAndOpenPoolWeek).not.toHaveBeenCalled();
      expect(poolWeekModel.markPoolWeekOpenAlerted).toHaveBeenCalledWith(
        closedWeek,
      );
      expect(adminAlerts.postAdminAlert).toHaveBeenCalledTimes(2);
      const failureAlert = vi
        .mocked(adminAlerts.postAdminAlert)
        .mock.calls.find(([message]) =>
          message.includes('failed to open'),
        )?.[0];
      expect(failureAlert).toContain('Spread Pool');
      expect(failureAlert).toContain('week 13');
      expect(failureAlert).toContain('1 game has no line');
    });

    it('alerts once naming a missing API key and creates the week to hold it', async () => {
      mockOpeningWeek(13, week13Games);
      delete process.env.SPREADS_API_KEY;
      vi.mocked(poolWeekModel.getPoolWeekByYearAndWeek).mockResolvedValue(null);
      const closedWeek = {
        ...poolWeek,
        weekNumber: 13,
        isOpen: false,
        openAlertedAt: null,
      };
      vi.mocked(poolWeekModel.createClosedPoolWeekWithLines).mockResolvedValue(
        closedWeek as never,
      );
      const fetchMock = vi.fn();
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const report = await syncSideGameWeeks(tuesdayOpen);

      expect(report.opened).toEqual([{ game: 'Locks Challenge', week: 13 }]);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(poolWeekModel.createClosedPoolWeekWithLines).toHaveBeenCalledWith(
        2026,
        13,
        [],
      );
      expect(poolWeekModel.markPoolWeekOpenAlerted).toHaveBeenCalledWith(
        closedWeek,
      );
      expect(adminAlerts.postAdminAlert).toHaveBeenCalledTimes(2);
      const failureAlert = vi
        .mocked(adminAlerts.postAdminAlert)
        .mock.calls.find(([message]) =>
          message.includes('failed to open'),
        )?.[0];
      expect(failureAlert).toContain('SPREADS_API_KEY is missing.');
    });

    it('alerts once naming an API error', async () => {
      mockOpeningWeek(13, week13Games);
      vi.mocked(poolWeekModel.getPoolWeekByYearAndWeek).mockResolvedValue(null);
      const closedWeek = {
        ...poolWeek,
        weekNumber: 13,
        isOpen: false,
        openAlertedAt: null,
      };
      vi.mocked(poolWeekModel.createClosedPoolWeekWithLines).mockResolvedValue(
        closedWeek as never,
      );
      globalThis.fetch = vi.fn(async () => {
        throw new Error('The Odds API is down');
      }) as unknown as typeof fetch;

      const report = await syncSideGameWeeks(tuesdayOpen);

      expect(report.opened).toEqual([{ game: 'Locks Challenge', week: 13 }]);
      expect(poolWeekModel.createClosedPoolWeekWithLines).toHaveBeenCalledWith(
        2026,
        13,
        [],
      );
      expect(adminAlerts.postAdminAlert).toHaveBeenCalledTimes(2);
      const failureAlert = vi
        .mocked(adminAlerts.postAdminAlert)
        .mock.calls.find(([message]) =>
          message.includes('failed to open'),
        )?.[0];
      expect(failureAlert).toContain('The Odds API is down');
    });

    it('posts nothing on a retry after the first failed open', async () => {
      mockOpeningWeek(13, week13Games);
      vi.mocked(locksWeekModel.getLocksWeekByYearAndWeek).mockImplementation(
        async (_year, weekNumber) =>
          weekNumber === 13
            ? ({ ...week, weekNumber: 13, isOpen: true } as never)
            : null,
      );
      let poolRow: Record<string, unknown> | null = null;
      vi.mocked(poolWeekModel.getPoolWeekByYearAndWeek).mockImplementation(
        async (_year, weekNumber) =>
          (weekNumber === 13 ? poolRow : null) as never,
      );
      vi.mocked(poolWeekModel.createClosedPoolWeekWithLines).mockImplementation(
        async (_year, weekNumber) => {
          poolRow = {
            ...poolWeek,
            weekNumber,
            isOpen: false,
            openAlertedAt: null,
          };
          return poolRow as never;
        },
      );
      vi.mocked(poolWeekModel.writeClosedPoolWeekLines).mockImplementation(
        async existing => existing,
      );
      vi.mocked(poolWeekModel.markPoolWeekOpenAlerted).mockImplementation(
        async existing => {
          poolRow = { ...existing, openAlertedAt: new Date() };
          return poolRow as never;
        },
      );
      globalThis.fetch = vi.fn(async () => ({
        ok: true,
        json: async () => [week13Odds[0]],
      })) as unknown as typeof fetch;

      const first = await syncSideGameWeeks(tuesdayOpen);
      const second = await syncSideGameWeeks(tuesdayOpen);

      expect(first.opened).toEqual([]);
      expect(second.opened).toEqual([]);
      expect(adminAlerts.postAdminAlert).toHaveBeenCalledTimes(1);
      expect(poolWeekModel.markPoolWeekOpenAlerted).toHaveBeenCalledTimes(1);
      expect(poolWeekModel.createClosedPoolWeekWithLines).toHaveBeenCalledTimes(
        1,
      );
      expect(poolWeekModel.writeClosedPoolWeekLines).toHaveBeenCalledTimes(1);
    });

    it('opens a week that failed before, clearing the failure marker', async () => {
      mockOpeningWeek(13, week13Games);
      vi.mocked(locksWeekModel.getLocksWeekByYearAndWeek).mockImplementation(
        async (_year, weekNumber) =>
          weekNumber === 13
            ? ({ ...week, weekNumber: 13, isOpen: true } as never)
            : null,
      );
      const markedWeek = {
        ...poolWeek,
        weekNumber: 13,
        isOpen: false,
        openAlertedAt: new Date('2026-11-20T13:00:00Z'),
      };
      vi.mocked(poolWeekModel.getPoolWeekByYearAndWeek).mockResolvedValue(
        markedWeek as never,
      );
      vi.mocked(poolWeekModel.openPoolWeekWithLines).mockResolvedValue({
        ...markedWeek,
        isOpen: true,
        openAlertedAt: null,
      } as never);

      const report = await syncSideGameWeeks(tuesdayOpen);

      expect(report.opened).toEqual([
        { game: 'Spread Pool', week: 13, detail: '2 games have lines' },
      ]);
      expect(poolWeekModel.openPoolWeekWithLines).toHaveBeenCalledWith(
        markedWeek,
        [
          { gameId: 'week-13-game-1', homeSpread: -3.5 },
          { gameId: 'week-13-game-2', homeSpread: -3.5 },
        ],
      );
      expect(poolWeekModel.createAndOpenPoolWeek).not.toHaveBeenCalled();
      expect(poolWeekModel.markPoolWeekOpenAlerted).not.toHaveBeenCalled();
      expect(adminAlerts.postAdminAlert).toHaveBeenCalledTimes(1);
      expect(vi.mocked(adminAlerts.postAdminAlert).mock.calls[0][0]).toContain(
        'has been opened',
      );
    });

    it('leaves an admin-owned week closed, empty and its odds unfetched', async () => {
      mockOpeningWeek(13, week13Games);
      vi.mocked(poolWeekModel.getPoolWeekByYearAndWeek).mockResolvedValue({
        ...poolWeek,
        weekNumber: 13,
        isOpen: false,
        autoManaged: false,
        openAlertedAt: null,
      } as never);
      const fetchMock = vi.fn();
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const report = await syncSideGameWeeks(tuesdayOpen);

      expect(report.opened).toEqual([{ game: 'Locks Challenge', week: 13 }]);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(
        poolWeekModel.createClosedPoolWeekWithLines,
      ).not.toHaveBeenCalled();
      expect(poolWeekModel.createAndOpenPoolWeek).not.toHaveBeenCalled();
      expect(poolWeekModel.writeClosedPoolWeekLines).not.toHaveBeenCalled();
      expect(poolWeekModel.openPoolWeekWithLines).not.toHaveBeenCalled();
      expect(poolWeekModel.markPoolWeekOpenAlerted).not.toHaveBeenCalled();
      expect(adminAlerts.postAdminAlert).toHaveBeenCalledTimes(1);
    });

    it('reports a failed failure alert as a warning without undoing the write', async () => {
      mockOpeningWeek(13, week13Games);
      vi.mocked(locksWeekModel.getLocksWeekByYearAndWeek).mockImplementation(
        async (_year, weekNumber) =>
          weekNumber === 13
            ? ({ ...week, weekNumber: 13, isOpen: true } as never)
            : null,
      );
      vi.mocked(poolWeekModel.getPoolWeekByYearAndWeek).mockResolvedValue(null);
      const closedWeek = {
        ...poolWeek,
        weekNumber: 13,
        isOpen: false,
        openAlertedAt: null,
      };
      vi.mocked(poolWeekModel.createClosedPoolWeekWithLines).mockResolvedValue(
        closedWeek as never,
      );
      globalThis.fetch = vi.fn(async () => ({
        ok: true,
        json: async () => [week13Odds[0]],
      })) as unknown as typeof fetch;
      vi.mocked(adminAlerts.postAdminAlert).mockRejectedValue(
        new Error('Missing Access'),
      );

      const report = await syncSideGameWeeks(tuesdayOpen);

      expect(report.opened).toEqual([]);
      expect(report.errors).toEqual([]);
      expect(report.warnings).toEqual([
        'Admin alert failed for Spread Pool week 13: Missing Access',
      ]);
      expect(poolWeekModel.createClosedPoolWeekWithLines).toHaveBeenCalled();
      expect(poolWeekModel.markPoolWeekOpenAlerted).toHaveBeenCalledWith(
        closedWeek,
      );
    });
  });
});
