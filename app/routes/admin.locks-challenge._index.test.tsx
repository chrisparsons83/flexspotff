import { action } from './admin.locks-challenge._index';
import type { ActionFunctionArgs } from '@remix-run/node';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as syncs from '~/libs/syncs.server';
import * as locksGameModel from '~/models/locksgame.server';
import * as locksWeekModel from '~/models/locksweek.server';
import * as nflGameModel from '~/models/nflgame.server';
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
vi.mock('~/models/locksgame.server');
vi.mock('~/models/locksgamepicks.server');
vi.mock('~/models/locksweek.server');
vi.mock('~/models/nflgame.server');
vi.mock('~/models/season.server');
vi.mock('~/utils/helpers');
vi.mock('~/db.server', () => ({
  prisma: {},
}));

const mockAdmin = { id: 'user-admin', discordName: 'Admin' };

const mockWeek = {
  id: 'locks-week-3',
  createdAt: new Date('2025-09-01'),
  updatedAt: new Date('2025-09-01'),
  year: 2025,
  weekNumber: 3,
  isOpen: true,
  isWeekScored: false,
  autoManaged: true,
};

const postForm = (fields: Record<string, string>) => {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) body.set(key, value);

  return action({
    request: new Request('http://test/admin/locks-challenge', {
      method: 'POST',
      body,
    }),
    params: {},
    context: {},
  } as ActionFunctionArgs);
};

describe('admin.locks-challenge action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth.authenticator.isAuthenticated).mockResolvedValue(
      mockAdmin as never,
    );
    vi.mocked(auth.requireAdmin).mockReturnValue(true);
    vi.mocked(seasonModel.getCurrentSeason).mockResolvedValue({
      year: 2025,
    } as never);
    vi.mocked(locksWeekModel.getNewestLocksWeekForYear).mockResolvedValue(null);
    vi.mocked(locksWeekModel.getLocksWeekByYearAndWeek).mockResolvedValue(
      mockWeek,
    );
    vi.mocked(nflGameModel.getWeekNflGames).mockResolvedValue([]);
    vi.mocked(locksGameModel.getLocksGamesByYearAndWeek).mockResolvedValue([]);
    vi.mocked(helpers.areAllNflGamesComplete).mockResolvedValue(true);
  });

  it('creates a week by hand as no longer auto-managed', async () => {
    await postForm({ _action: 'createNewWeek' });

    expect(locksWeekModel.createLocksWeek).toHaveBeenCalledWith({
      year: 2025,
      weekNumber: 1,
      isOpen: false,
      isWeekScored: false,
      autoManaged: false,
    });
  });

  it('takes the week from the automation when an admin publishes it', async () => {
    await postForm({
      _action: 'publishWeek',
      weekNumber: '3',
      year: '2025',
    });

    expect(locksWeekModel.updateLocksWeek).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'locks-week-3',
        isOpen: true,
        autoManaged: false,
      }),
    );
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
    expect(locksWeekModel.updateLocksWeek).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'locks-week-3',
        isWeekScored: true,
        autoManaged: false,
      }),
    );
  });
});
