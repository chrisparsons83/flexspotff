import * as refresh from './refresh.server';
import { syncQbStreaming } from './sync.server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as adminAlerts from '~/libs/admin-alerts.server';
import * as nflGameModel from '~/models/nflgame.server';
import * as qbWeekModel from '~/models/qbstreamingweek.server';
import * as seasonModel from '~/models/season.server';

vi.mock('./refresh.server');
vi.mock('~/libs/admin-alerts.server');
vi.mock('~/models/nflgame.server');
vi.mock('~/models/qbstreamingweek.server');
vi.mock('~/models/season.server');
vi.mock('~/db.server', () => ({ prisma: {} }));

// Week 10 kicks off Thursday 12 November 2026, 8:15pm EST, so it opens at
// 8am EST on Wednesday 11 November: 13:00 UTC.
const thursday = new Date('2026-11-13T01:15:00Z');
const sunday = new Date('2026-11-15T18:00:00Z');
const games = [
  { id: 'g1', gameStartTime: thursday },
  { id: 'g2', gameStartTime: sunday },
];

const week = { id: 'w10', year: 2026, week: 10, isOpen: true, isScored: false };
const dalton = { fullName: 'Andy Dalton', isDeep: true, matchup: 'CAR vs ATL' };
const noChanges = { added: [], restored: [], removed: [] };

describe('syncQbStreaming', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(seasonModel.getCurrentSeason).mockResolvedValue({
      year: 2026,
    } as never);
    vi.mocked(nflGameModel.getCurrentNflWeek).mockResolvedValue(10);
    vi.mocked(nflGameModel.getWeekNflGames).mockResolvedValue(games as never);
    vi.mocked(qbWeekModel.getQBStreamingWeekByYearAndWeek).mockResolvedValue(
      null,
    );
    vi.mocked(qbWeekModel.createQBStreamingWeek).mockResolvedValue(week);
    vi.mocked(refresh.refreshQbStreamingWeek).mockResolvedValue(noChanges);
    vi.mocked(adminAlerts.postAdminAlert).mockResolvedValue({
      status: 'posted',
      messages: 1,
    });
  });

  it('waits until 8am Eastern Wednesday before creating the week', async () => {
    const result = await syncQbStreaming(new Date('2026-11-11T12:59:00Z'));

    expect(result.message).toContain('opens at 2026-11-11T13:00:00.000Z');
    expect(qbWeekModel.createQBStreamingWeek).not.toHaveBeenCalled();
    expect(refresh.refreshQbStreamingWeek).not.toHaveBeenCalled();
  });

  it('creates, fills and opens the week, then posts the full list', async () => {
    vi.mocked(refresh.refreshQbStreamingWeek).mockResolvedValue({
      ...noChanges,
      added: [dalton],
    });

    const result = await syncQbStreaming(new Date('2026-11-11T13:00:00Z'));

    expect(qbWeekModel.createQBStreamingWeek).toHaveBeenCalledWith({
      year: 2026,
      week: 10,
      isOpen: true,
      isScored: false,
    });
    expect(result).toEqual({ message: 'Opened week 10 with 1 QBs' });
    expect(adminAlerts.postAdminAlert).toHaveBeenCalledWith(
      expect.stringContaining('QB Streaming week 10 is open with 1 QBs.'),
    );
  });

  it('catches up on a later run if the 8am one was missed', async () => {
    await syncQbStreaming(new Date('2026-11-12T01:00:00Z'));

    expect(qbWeekModel.createQBStreamingWeek).toHaveBeenCalled();
  });

  it('refreshes an existing week without reopening it', async () => {
    vi.mocked(qbWeekModel.getQBStreamingWeekByYearAndWeek).mockResolvedValue({
      ...week,
      isOpen: false,
    });
    vi.mocked(refresh.refreshQbStreamingWeek).mockResolvedValue({
      ...noChanges,
      removed: [dalton],
    });

    await syncQbStreaming(new Date('2026-11-12T13:00:00Z'));

    expect(qbWeekModel.createQBStreamingWeek).not.toHaveBeenCalled();
    expect(qbWeekModel.updateQBStreamingWeek).not.toHaveBeenCalled();
    expect(refresh.refreshQbStreamingWeek).toHaveBeenCalled();
    expect(adminAlerts.postAdminAlert).toHaveBeenCalledWith(
      expect.stringContaining('**Removed, projected at 0**'),
    );
  });

  it('posts nothing when a refresh changes nothing', async () => {
    vi.mocked(qbWeekModel.getQBStreamingWeekByYearAndWeek).mockResolvedValue(
      week,
    );

    await syncQbStreaming(new Date('2026-11-12T13:00:00Z'));

    expect(refresh.refreshQbStreamingWeek).toHaveBeenCalled();
    expect(adminAlerts.postAdminAlert).not.toHaveBeenCalled();
  });

  it('stops refreshing once every game has started', async () => {
    vi.mocked(qbWeekModel.getQBStreamingWeekByYearAndWeek).mockResolvedValue(
      week,
    );

    await syncQbStreaming(new Date('2026-11-15T18:00:00Z'));

    expect(refresh.refreshQbStreamingWeek).not.toHaveBeenCalled();
  });

  it('leaves a scored week alone', async () => {
    vi.mocked(qbWeekModel.getQBStreamingWeekByYearAndWeek).mockResolvedValue({
      ...week,
      isScored: true,
    });

    await syncQbStreaming(new Date('2026-11-12T13:00:00Z'));

    expect(refresh.refreshQbStreamingWeek).not.toHaveBeenCalled();
  });

  it('reports a failed alert without undoing the week', async () => {
    vi.mocked(adminAlerts.postAdminAlert).mockRejectedValue(
      new Error('Missing Access'),
    );

    const result = await syncQbStreaming(new Date('2026-11-11T13:00:00Z'));

    expect(qbWeekModel.createQBStreamingWeek).toHaveBeenCalled();
    expect(result.alertError).toBe('Missing Access');
  });
});
