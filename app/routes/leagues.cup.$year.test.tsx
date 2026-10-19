import { loader } from './leagues.cup.$year';
import type { LoaderFunctionArgs } from '@remix-run/node';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as cupModel from '~/models/cup.server';
import * as seasonModel from '~/models/season.server';

vi.mock('~/models/cup.server');
vi.mock('~/models/cupgame.server');
vi.mock('~/models/cupweek.server');
vi.mock('~/models/season.server');
vi.mock('~/models/teamgame.server');
vi.mock('~/db.server', () => ({
  prisma: {},
}));

const loaderArgs = (year: string) =>
  ({
    params: { year },
    request: new Request(`http://localhost/leagues/cup/${year}`),
    context: {},
  } as LoaderFunctionArgs);

describe('leagues.cup.$year', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(seasonModel.getCurrentSeason).mockResolvedValue({
      year: 2026,
    } as Awaited<ReturnType<typeof seasonModel.getCurrentSeason>>);
    vi.mocked(cupModel.getCupByYear).mockResolvedValue(null);
    vi.mocked(cupModel.getCups).mockResolvedValue([]);
  });

  it('shows a placeholder for the current season before its Cup exists', async () => {
    const response = await loader(loaderArgs('2026'));
    const data = await response.json();

    expect(data).toMatchObject({ bracket: null, year: 2026, years: [] });
  });

  it('is a 404 for a year that is not a number', async () => {
    await expect(loader(loaderArgs('2026abc'))).rejects.toMatchObject({
      status: 404,
    });
    expect(cupModel.getCupByYear).not.toHaveBeenCalled();
  });

  it('is a 404 for a past year with no Cup', async () => {
    await expect(loader(loaderArgs('2015'))).rejects.toMatchObject({
      status: 404,
    });
  });
});
