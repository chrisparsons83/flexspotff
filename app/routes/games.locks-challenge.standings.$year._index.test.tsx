import { loader } from './games.locks-challenge.standings.$year._index';
import type { LoaderFunctionArgs } from '@remix-run/node';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as locksGamePicksModel from '~/models/locksgamepicks.server';
import * as locksWeekModel from '~/models/locksweek.server';
import * as userModel from '~/models/user.server';

vi.mock('~/models/locksgame.server');
vi.mock('~/models/locksgamepicks.server');
vi.mock('~/models/locksweek.server');
vi.mock('~/models/user.server');
vi.mock('~/db.server', () => ({
  prisma: {},
}));

const loaderArgs = (year: string) =>
  ({
    params: { year },
    request: new Request(
      `http://localhost/games/locks-challenge/standings/${year}`,
    ),
    context: {},
  } as LoaderFunctionArgs);

describe('games.locks-challenge.standings.$year._index', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('shows empty standings for a season with no weeks yet', async () => {
    vi.mocked(locksWeekModel.getLocksWeeksByYear).mockResolvedValue([]);
    vi.mocked(locksGamePicksModel.getLocksGamePicksWonLoss).mockResolvedValue(
      [] as Awaited<
        ReturnType<typeof locksGamePicksModel.getLocksGamePicksWonLoss>
      >,
    );
    vi.mocked(userModel.getUsersByIds).mockResolvedValue([]);

    const response = await loader(loaderArgs('2026'));
    const data = await response.json();

    expect(data).toMatchObject({ totalPoints: [], users: [], year: 2026 });
    expect(locksWeekModel.getLocksWeekByYearAndWeek).not.toHaveBeenCalled();
  });
});
