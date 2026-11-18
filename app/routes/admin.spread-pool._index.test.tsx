import { action } from './admin.spread-pool._index';
import type { ActionFunctionArgs } from '@remix-run/node';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as syncs from '~/libs/syncs.server';
import * as poolGameModel from '~/models/poolgame.server';
import * as poolGamePickModel from '~/models/poolgamepicks.server';
import * as poolWeekModel from '~/models/poolweek.server';
import * as seasonModel from '~/models/season.server';
import * as auth from '~/services/auth.server';
import * as helpers from '~/utils/helpers';

vi.mock('~/services/auth.server', () => ({
  authenticator: {
    isAuthenticated: vi.fn(),
  },
  requireAdmin: vi.fn(),
}));
vi.mock('~/libs/syncs.server');
vi.mock('~/models/poolgame.server');
vi.mock('~/models/poolgamepicks.server');
vi.mock('~/models/poolweek.server');
vi.mock('~/models/poolweekmissed.server');
vi.mock('~/models/season.server');
vi.mock('~/utils/helpers');
vi.mock('~/db.server', () => ({
  prisma: {},
}));

const mockAdmin = { id: 'user-admin', discordName: 'Admin' };

const mockWeek = {
  id: 'pool-week-3',
  createdAt: new Date('2025-09-01'),
  updatedAt: new Date('2025-09-01'),
  year: 2025,
  weekNumber: 3,
  isOpen: true,
  isWeekScored: false,
  autoManaged: true,
  openAlertedAt: null,
};

const postForm = (fields: Record<string, string>) => {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) body.set(key, value);

  return action({
    request: new Request('http://test/admin/spread-pool', {
      method: 'POST',
      body,
    }),
    params: {},
    context: {},
  } as ActionFunctionArgs);
};

describe('admin.spread-pool action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth.authenticator.isAuthenticated).mockResolvedValue(
      mockAdmin as never,
    );
    vi.mocked(auth.requireAdmin).mockReturnValue(true);
    vi.mocked(seasonModel.getCurrentSeason).mockResolvedValue({
      year: 2025,
    } as never);
    vi.mocked(poolWeekModel.getNewestPoolWeekForYear).mockResolvedValue(null);
    vi.mocked(poolWeekModel.getPoolWeekByYearAndWeek).mockResolvedValue(
      mockWeek,
    );
    vi.mocked(poolGamePickModel.getPoolGamesPicksByPoolWeek).mockResolvedValue(
      [],
    );
    vi.mocked(poolGamePickModel.getPoolGamePicksWonLoss).mockResolvedValue([]);
    vi.mocked(poolGameModel.getPoolGamesByYearAndWeek).mockResolvedValue([]);
    vi.mocked(helpers.areAllNflGamesComplete).mockResolvedValue(true);
  });

  it('creates a week by hand as no longer auto-managed', async () => {
    await postForm({ _action: 'createNewWeek' });

    expect(poolWeekModel.createPoolWeek).toHaveBeenCalledWith({
      year: 2025,
      weekNumber: 1,
      isOpen: false,
      isWeekScored: false,
      autoManaged: false,
      openAlertedAt: null,
    });
  });

  it('takes the week from the automation when an admin scores it', async () => {
    await postForm({
      _action: 'scoreWeek',
      weekNumber: '3',
      year: '2025',
    });

    expect(syncs.syncNflGameWeek).toHaveBeenCalledWith(2025, [3], {
      removeStaleGames: true,
    });
    expect(poolWeekModel.updatePoolWeek).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'pool-week-3',
        isWeekScored: true,
        autoManaged: false,
      }),
    );
  });
});
