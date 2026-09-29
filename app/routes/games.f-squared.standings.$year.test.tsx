import { loader } from './games.f-squared.standings.$year';
import type { LoaderFunctionArgs } from '@remix-run/node';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as fSquaredModel from '~/models/fsquared.server';

vi.mock('~/models/fsquared.server');
// Only the loader is under test. The page's GoBox loads headlessui, which,
// loaded here, breaks later component tests sharing the thread.
vi.mock('~/components/layout/f-squared/FSquaredYearPicker', () => ({
  default: () => null,
}));
vi.mock('~/db.server', () => ({
  prisma: {},
}));

const loaderArgs = (year: string) =>
  ({
    params: { year },
    request: new Request(`http://localhost/games/f-squared/standings/${year}`),
    context: {},
  } as LoaderFunctionArgs);

describe('games.f-squared.standings.$year', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(fSquaredModel.getFSquaredYears).mockResolvedValue([2020, 2019]);
  });

  it('is a 404 for a year nobody entered', async () => {
    vi.mocked(fSquaredModel.getStandingsForYear).mockResolvedValue([]);

    await expect(loader(loaderArgs('2015'))).rejects.toMatchObject({
      status: 404,
    });
  });

  it('is a 404 for a year that is not a number', async () => {
    await expect(loader(loaderArgs('latest'))).rejects.toMatchObject({
      status: 404,
    });
    expect(fSquaredModel.getStandingsForYear).not.toHaveBeenCalled();
  });

  it('shows the year with the years to choose from', async () => {
    const standings = [{ id: 'entry-1' }] as Awaited<
      ReturnType<typeof fSquaredModel.getStandingsForYear>
    >;
    vi.mocked(fSquaredModel.getStandingsForYear).mockResolvedValue(standings);

    const response = await loader(loaderArgs('2020'));
    const data = await response.json();

    expect(fSquaredModel.getStandingsForYear).toHaveBeenCalledWith(2020);
    expect(data).toMatchObject({ year: 2020, years: [2020, 2019] });
    expect(data.results).toHaveLength(1);
  });
});
