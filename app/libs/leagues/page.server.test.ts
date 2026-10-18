import { requireLeague } from './page.server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLeagueByYearAndName } from '~/models/league.server';

vi.mock('~/models/league.server', () => ({
  getLeagueByYearAndName: vi.fn(),
}));

const findLeague = vi.mocked(getLeagueByYearAndName);

const run = (path: string) => {
  const [, , year, league] = new URL(`http://test${path}`).pathname.split('/');
  return requireLeague({
    params: { year, league },
    request: new Request(`http://test${path}`),
  }).catch((thrown: unknown) => thrown);
};

describe('requireLeague', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('finds the league by year and lower-case name', async () => {
    findLeague.mockResolvedValue({ id: 'league-1' } as never);

    expect(await run('/leagues/2026/admiral')).toEqual({ id: 'league-1' });
    expect(findLeague).toHaveBeenCalledWith(2026, 'admiral');
  });

  it('sends a capitalised name to the lower-case address', async () => {
    const response = (await run(
      '/leagues/2026/Admiral/matchups/3?x=1',
    )) as Response;

    expect(response.status).toBe(301);
    expect(response.headers.get('Location')).toBe(
      '/leagues/2026/admiral/matchups/3?x=1',
    );
    expect(findLeague).not.toHaveBeenCalled();
  });

  it.each([
    ['a year that is not a number', '/leagues/next/admiral'],
    ['a year before the first season', '/leagues/2017/admiral'],
    ['a name that is not a league', '/leagues/2026/rules'],
  ])('is a 404 for %s', async (_, path) => {
    const response = (await run(path)) as Response;
    expect(response.status).toBe(404);
    expect(findLeague).not.toHaveBeenCalled();
  });

  it('is a 404 for a league that did not run that year', async () => {
    findLeague.mockResolvedValue(null);
    expect(((await run('/leagues/2018/monarch')) as Response).status).toBe(404);
  });
});
