import { getSleeperLeagueUsers, syncLeague } from './league-sync.server';
import * as syncs from './syncs.server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { League } from '~/models/league.server';
import * as leagueModel from '~/models/league.server';
import * as teamModel from '~/models/team.server';
import * as userModel from '~/models/user.server';

vi.mock('./syncs.server');
vi.mock('~/models/league.server');
vi.mock('~/models/team.server');
vi.mock('~/models/user.server');
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

describe('syncLeague', () => {
  const realFetch = globalThis.fetch;

  const league = {
    id: 'league-1',
    name: 'Champions',
    year: 2024,
    sleeperLeagueId: 'sleeper-league-1',
    sleeperDraftId: 'sleeper-draft-1',
    isDrafted: true,
    isActive: true,
    tier: 1,
    draftDateTime: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  } as League;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(teamModel.getTeams).mockResolvedValue([]);
    vi.mocked(teamModel.createTeam).mockResolvedValue({} as never);
    vi.mocked(teamModel.updateTeam).mockResolvedValue({} as never);
    vi.mocked(leagueModel.updateLeague).mockResolvedValue({} as never);
    vi.mocked(syncs.syncAdp).mockResolvedValue(undefined as never);

    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      const href = url.toString();
      if (href.includes('/rosters')) {
        return {
          ok: true,
          json: async () => [
            {
              league_id: 'sleeper-league-1',
              roster_id: 1,
              owner_id: 'owner-1',
              settings: {
                wins: 8,
                losses: 6,
                ties: 0,
                total_moves: 0,
                waiver_budget_used: 0,
              },
              metadata: null,
            },
          ],
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({
          status: 'complete',
          season: '2024',
          start_time: null,
          draft_order: null,
        }),
      } as Response;
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('resolves a Sleeper link that still points at a merged member', async () => {
    vi.mocked(userModel.getUsersIncludingMerged).mockResolvedValue([
      {
        id: 'tombstone-1',
        discordName: 'Panda',
        mergedInto: { id: 'canonical-1', discordName: 'pandabair' },
        sleeperUsers: [{ sleeperOwnerID: 'owner-1', userId: 'tombstone-1' }],
      },
    ] as never);

    await syncLeague(league);

    // Dropping merged members instead would leave this unresolved and save the
    // team with userId: null, which takes the season out of the record book.
    expect(teamModel.createTeam).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'canonical-1' }),
    );
  });

  it('leaves a team unowned when no member claims the Sleeper account', async () => {
    vi.mocked(userModel.getUsersIncludingMerged).mockResolvedValue([]);

    await syncLeague(league);

    expect(teamModel.createTeam).toHaveBeenCalledWith(
      expect.objectContaining({ userId: null }),
    );
  });
});
