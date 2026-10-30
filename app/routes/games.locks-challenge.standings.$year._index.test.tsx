import { loader } from './games.locks-challenge.standings.$year._index';
import type { LoaderFunctionArgs } from '@remix-run/node';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as locksGamePicksModel from '~/models/locksgamepicks.server';
import * as locksWeekModel from '~/models/locksweek.server';
import * as sideGameSeasons from '~/models/profile/sideGameSeasons.server';
import * as seasonModel from '~/models/season.server';
import * as userModel from '~/models/user.server';

vi.mock('~/models/locksgame.server');
vi.mock('~/models/locksgamepicks.server');
vi.mock('~/models/locksweek.server');
vi.mock('~/models/profile/sideGameSeasons.server');
vi.mock('~/models/season.server');
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
    vi.mocked(seasonModel.getCurrentSeason).mockResolvedValue({
      year: 2026,
    } as Awaited<ReturnType<typeof seasonModel.getCurrentSeason>>);
    vi.mocked(sideGameSeasons.sideGameYears).mockResolvedValue([]);
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

  it('adds up each week, with a loss voiding that week', async () => {
    const week1 = { id: 'w1', year: 2025, weekNumber: 1, isOpen: false };
    const week2 = { id: 'w2', year: 2025, weekNumber: 2, isOpen: false };
    vi.mocked(locksWeekModel.getLocksWeeksByYear).mockResolvedValue([
      week2,
      week1,
    ] as Awaited<ReturnType<typeof locksWeekModel.getLocksWeeksByYear>>);
    vi.mocked(
      locksGamePicksModel.getLocksGamePicksWonLossWeek,
    ).mockImplementation((async (locksWeek: { id: string }) =>
      locksWeek.id === 'w1'
        ? [
            { userId: 'a', _sum: { isWin: 3, isLoss: 0, isTie: 0 } },
            { userId: 'b', _sum: { isWin: 4, isLoss: 1, isTie: 0 } },
          ]
        : [
            { userId: 'a', _sum: { isWin: 2, isLoss: 0, isTie: 0 } },
            { userId: 'b', _sum: { isWin: 2, isLoss: 0, isTie: 0 } },
          ]) as unknown as typeof locksGamePicksModel.getLocksGamePicksWonLossWeek);
    vi.mocked(locksGamePicksModel.getLocksGamePicksWonLoss).mockResolvedValue([
      { userId: 'a', _sum: { isWin: 5, isLoss: 0, isTie: 0 } },
      { userId: 'b', _sum: { isWin: 6, isLoss: 1, isTie: 0 } },
    ] as Awaited<ReturnType<typeof locksGamePicksModel.getLocksGamePicksWonLoss>>);
    vi.mocked(userModel.getUsersByIds).mockResolvedValue([]);

    const response = await loader(loaderArgs('2025'));
    const data = await response.json();

    expect(
      data.totalPoints.map(
        (point: { userId: string; _sum: { points: number; rank: number } }) => [
          point.userId,
          point._sum.points,
          point._sum.rank,
        ],
      ),
    ).toEqual([
      ['a', 5, 1],
      ['b', 2, 2],
    ]);
    expect(locksWeekModel.getLocksWeekByYearAndWeek).not.toHaveBeenCalled();
  });

  it('is a 404 for a past year with no weeks', async () => {
    vi.mocked(locksWeekModel.getLocksWeeksByYear).mockResolvedValue([]);

    await expect(loader(loaderArgs('1999'))).rejects.toMatchObject({
      status: 404,
    });
  });
});
