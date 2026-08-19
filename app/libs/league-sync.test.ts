import { getSleeperLeagueUsers } from './league-sync.server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('~/db.server', () => ({
  prisma: {},
}));

describe('getSleeperLeagueUsers', () => {
  const realFetch = globalThis.fetch;
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  const mockResponse = (body: unknown, ok = true, status = 200) =>
    mockFetch.mockResolvedValue({
      ok,
      status,
      json: async () => body,
    } as Response);

  it('keys the league users by Sleeper owner ID', async () => {
    mockResponse([
      {
        user_id: 'owner-1',
        username: 'ffguy',
        display_name: 'FF Guy',
        metadata: { team_name: 'The Guys' },
      },
    ]);

    const users = await getSleeperLeagueUsers('league-1');

    expect(users.get('owner-1')).toEqual({
      sleeperOwnerId: 'owner-1',
      username: 'ffguy',
      displayName: 'FF Guy',
      teamName: 'The Guys',
    });
  });

  it('fills in nulls for the fields Sleeper leaves off', async () => {
    mockResponse([{ user_id: 'owner-1' }]);

    expect(await getSleeperLeagueUsers('league-1')).toEqual(
      new Map([
        [
          'owner-1',
          {
            sleeperOwnerId: 'owner-1',
            username: null,
            displayName: null,
            teamName: null,
          },
        ],
      ]),
    );
  });

  // Sleeper answers 200 with a null body for a league ID it doesn't recognize.
  it('throws a readable error when the body is not a user list', async () => {
    mockResponse(null);

    await expect(getSleeperLeagueUsers('bad-league')).rejects.toThrow(
      'Sleeper returned no usable user list for league bad-league',
    );
  });

  it('throws on a non-OK response', async () => {
    mockResponse(null, false, 500);

    await expect(getSleeperLeagueUsers('league-1')).rejects.toThrow(
      'Sleeper user lookup failed for league league-1 (500)',
    );
  });
});
