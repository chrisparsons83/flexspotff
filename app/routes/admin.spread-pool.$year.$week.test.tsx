import { action } from './admin.spread-pool.$year.$week';
import type { ActionFunctionArgs } from '@remix-run/node';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as nflGameModel from '~/models/nflgame.server';
import * as poolGameModel from '~/models/poolgame.server';
import * as poolWeekModel from '~/models/poolweek.server';
import * as seasonModel from '~/models/season.server';
import * as auth from '~/services/auth.server';

vi.mock('~/services/auth.server', () => ({
  authenticator: {
    isAuthenticated: vi.fn(),
  },
  requireAdmin: vi.fn(),
}));
vi.mock('~/models/nflgame.server');
vi.mock('~/models/poolgame.server');
vi.mock('~/models/poolweek.server');
vi.mock('~/models/season.server');
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
  isOpen: false,
  isWeekScored: false,
  autoManaged: true,
};

const postForm = (fields: Record<string, string>) => {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) body.set(key, value);

  return action({
    request: new Request('http://test/admin/spread-pool/2025/3', {
      method: 'POST',
      body,
    }),
    params: { year: '2025', week: '3' },
    context: {},
  } as ActionFunctionArgs);
};

describe('admin.spread-pool.$year.$week action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth.authenticator.isAuthenticated).mockResolvedValue(
      mockAdmin as never,
    );
    vi.mocked(auth.requireAdmin).mockReturnValue(true);
    vi.mocked(seasonModel.getCurrentSeason).mockResolvedValue({
      year: 2025,
    } as never);
    vi.mocked(poolWeekModel.getPoolWeekByYearAndWeek).mockResolvedValue(
      mockWeek,
    );
    vi.mocked(nflGameModel.getWeekNflGames).mockResolvedValue([]);
    vi.mocked(poolGameModel.getPoolGamesByYearAndWeek).mockResolvedValue([]);
  });

  it('takes the week from the automation when an admin opens it', async () => {
    await postForm({
      _action: 'updateSpreads',
      isOpen: 'on',
      'homeSpread[game-1]': '-3.5',
    });

    expect(poolWeekModel.updatePoolWeek).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'pool-week-3',
        isOpen: true,
        autoManaged: false,
      }),
    );
  });
});
