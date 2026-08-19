import { action, loader } from './admin.members.unmatched';
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as leagueSync from '~/libs/league-sync.server';
import * as leagueModel from '~/models/league.server';
import * as seasonModel from '~/models/season.server';
import * as sleeperUserModel from '~/models/sleeperUser.server';
import type { User } from '~/models/user.server';
import * as userModel from '~/models/user.server';
import * as auth from '~/services/auth.server';

vi.mock('~/services/auth.server', () => ({
  authenticator: {
    isAuthenticated: vi.fn(),
  },
  requireAdmin: vi.fn(),
}));
vi.mock('~/libs/league-sync.server');
vi.mock('~/models/league.server');
vi.mock('~/models/season.server');
vi.mock('~/models/sleeperUser.server');
vi.mock('~/models/user.server');
vi.mock('~/db.server', () => ({
  prisma: {},
}));

const mockUser: User = {
  id: 'user-admin',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  discordId: 'discord-admin',
  discordName: 'Admin',
  discordAvatar: '',
  discordRoles: [],
  mergedIntoId: null,
  mergedAt: null,
};

const makeMember = (id: string, discordName: string) => ({
  ...mockUser,
  id,
  discordName,
  sleeperUsers: [],
});

const makeTeam = (id: string, sleeperOwnerId: string) => ({
  id,
  sleeperOwnerId,
  userId: null,
});

const makeSleeperUser = (
  sleeperOwnerId: string,
  username: string | null,
  displayName: string | null,
  teamName: string | null = null,
) => ({ sleeperOwnerId, username, displayName, teamName });

const loaderArgs = {
  params: {},
  request: new Request('http://localhost/admin/members/unmatched'),
  context: {},
} as LoaderFunctionArgs;

const actionArgs = (formData: Record<string, string>) => {
  const body = new FormData();
  for (const [key, value] of Object.entries(formData)) {
    body.set(key, value);
  }

  return {
    params: {},
    request: new Request('http://localhost/admin/members/unmatched', {
      method: 'POST',
      body,
    }),
    context: {},
  } as ActionFunctionArgs;
};

describe('Admin unmatched Sleeper users', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-expect-error - Mocking narrower type (User) than actual (User | null)
    vi.mocked(auth.authenticator.isAuthenticated).mockResolvedValue(mockUser);
    vi.mocked(seasonModel.getCurrentSeason).mockResolvedValue({
      id: 'season-1',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      year: 2024,
      isCurrent: true,
      isOpenForRegistration: false,
      isOpenForFSquared: false,
      isOpenForDFSSurvivor: false,
      registrationSize: 0,
    });
  });

  describe('loader', () => {
    it('lists only the teams with no Sleeper mapping', async () => {
      vi.mocked(leagueModel.getLeaguesByYear).mockResolvedValue([
        {
          id: 'league-1',
          name: 'Champions',
          tier: 1,
          sleeperLeagueId: 'sleeper-league-1',
          teams: [makeTeam('team-1', 'owner-1'), makeTeam('team-2', 'owner-2')],
        },
      ] as any);
      vi.mocked(userModel.getUsers).mockResolvedValue([
        makeMember('user-1', 'Chris'),
      ] as any);
      vi.mocked(sleeperUserModel.getSleeperUsersByOwnerIds).mockResolvedValue([
        { sleeperOwnerID: 'owner-1', userId: 'user-1' },
      ] as any);
      vi.mocked(leagueSync.getSleeperLeagueUsers).mockResolvedValue(
        new Map([
          [
            'owner-2',
            makeSleeperUser('owner-2', 'ffguy', 'FF Guy', 'The Guys'),
          ],
        ]),
      );

      const data = await (await loader(loaderArgs)).json();

      expect(data.totalUnmatched).toBe(1);
      expect(data.leagues[0].unmatchedTeams).toEqual([
        {
          teamId: 'team-2',
          sleeperOwnerId: 'owner-2',
          username: 'ffguy',
          displayName: 'FF Guy',
          teamName: 'The Guys',
          suggestedMemberId: '',
        },
      ]);
    });

    it('suggests the member whose Discord name matches the Sleeper name', async () => {
      vi.mocked(leagueModel.getLeaguesByYear).mockResolvedValue([
        {
          id: 'league-1',
          name: 'Champions',
          tier: 1,
          sleeperLeagueId: 'sleeper-league-1',
          teams: [
            makeTeam('team-1', 'owner-1'),
            makeTeam('team-2', 'owner-2'),
            makeTeam('team-3', 'owner-3'),
          ],
        },
      ] as any);
      vi.mocked(userModel.getUsers).mockResolvedValue([
        makeMember('user-1', 'Big Cat'),
        // Two members share this name, so it can't be suggested for either.
        makeMember('user-2', 'Twin'),
        makeMember('user-3', 'twin'),
        // Normalizes to an empty string, which must not match anybody.
        makeMember('user-4', '🔥🔥🔥'),
      ] as any);
      vi.mocked(sleeperUserModel.getSleeperUsersByOwnerIds).mockResolvedValue(
        [],
      );
      vi.mocked(leagueSync.getSleeperLeagueUsers).mockResolvedValue(
        new Map([
          ['owner-1', makeSleeperUser('owner-1', 'big_cat', 'BigCat')],
          ['owner-2', makeSleeperUser('owner-2', 'twin', 'Twin')],
          ['owner-3', makeSleeperUser('owner-3', '...', '!!!')],
        ]),
      );

      const data = await (await loader(loaderArgs)).json();

      expect(
        data.leagues[0].unmatchedTeams.map(
          (team: { sleeperOwnerId: string; suggestedMemberId: string }) => [
            team.sleeperOwnerId,
            team.suggestedMemberId,
          ],
        ),
      ).toEqual([
        ['owner-1', 'user-1'],
        ['owner-2', ''],
        ['owner-3', ''],
      ]);
    });

    it('keeps going when Sleeper will not hand over a league roster', async () => {
      vi.mocked(leagueModel.getLeaguesByYear).mockResolvedValue([
        {
          id: 'league-1',
          name: 'Champions',
          tier: 1,
          sleeperLeagueId: 'sleeper-league-1',
          teams: [makeTeam('team-1', 'owner-1')],
        },
      ] as any);
      vi.mocked(userModel.getUsers).mockResolvedValue([]);
      vi.mocked(sleeperUserModel.getSleeperUsersByOwnerIds).mockResolvedValue(
        [],
      );
      vi.mocked(leagueSync.getSleeperLeagueUsers).mockRejectedValue(
        new Error('Sleeper is down'),
      );

      const data = await (await loader(loaderArgs)).json();

      expect(data.leagues[0].lookupError).toBe('Sleeper is down');
      expect(data.leagues[0].unmatchedTeams[0]).toMatchObject({
        sleeperOwnerId: 'owner-1',
        username: null,
        displayName: null,
      });
    });

    it('does not call Sleeper for a league that is fully matched', async () => {
      vi.mocked(leagueModel.getLeaguesByYear).mockResolvedValue([
        {
          id: 'league-1',
          name: 'Champions',
          tier: 1,
          sleeperLeagueId: 'sleeper-league-1',
          teams: [makeTeam('team-1', 'owner-1')],
        },
      ] as any);
      vi.mocked(userModel.getUsers).mockResolvedValue([]);
      vi.mocked(sleeperUserModel.getSleeperUsersByOwnerIds).mockResolvedValue([
        { sleeperOwnerID: 'owner-1', userId: 'user-1' },
      ] as any);

      const data = await (await loader(loaderArgs)).json();

      expect(leagueSync.getSleeperLeagueUsers).not.toHaveBeenCalled();
      expect(data.totalUnmatched).toBe(0);
    });
  });

  describe('action', () => {
    it('matches the Sleeper owner to the member', async () => {
      vi.mocked(userModel.getUser).mockResolvedValue(
        makeMember('user-1', 'Chris'),
      );
      vi.mocked(sleeperUserModel.getSleeperUserByOwnerId).mockResolvedValue(
        null,
      );
      vi.mocked(sleeperUserModel.matchSleeperOwnerToUser).mockResolvedValue({
        sleeperUser: { sleeperOwnerID: 'owner-2', userId: 'user-1' },
        teamsUpdated: 2,
      });

      const data = await (
        await action(
          actionArgs({ sleeperOwnerID: 'owner-2', userId: 'user-1' }),
        )
      ).json();

      expect(sleeperUserModel.matchSleeperOwnerToUser).toHaveBeenCalledWith({
        sleeperOwnerID: 'owner-2',
        userId: 'user-1',
      });
      expect(data.status).toBe('success');
      expect(data.message).toContain('Chris');
      expect(data.message).toContain('2 teams');
    });

    it('rejects a submit with no member picked', async () => {
      const data = await (
        await action(actionArgs({ sleeperOwnerID: 'owner-2', userId: '' }))
      ).json();

      expect(data.status).toBe('error');
      expect(sleeperUserModel.matchSleeperOwnerToUser).not.toHaveBeenCalled();
    });

    it('rejects a member ID that does not exist', async () => {
      vi.mocked(userModel.getUser).mockResolvedValue(null);

      const data = await (
        await action(actionArgs({ sleeperOwnerID: 'owner-2', userId: 'nope' }))
      ).json();

      expect(data.status).toBe('error');
      expect(sleeperUserModel.matchSleeperOwnerToUser).not.toHaveBeenCalled();
    });

    it('refuses a stale submit for an owner someone already matched', async () => {
      vi.mocked(userModel.getUser).mockResolvedValue(
        makeMember('user-1', 'Chris'),
      );
      vi.mocked(sleeperUserModel.getSleeperUserByOwnerId).mockResolvedValue({
        sleeperOwnerID: 'owner-2',
        userId: 'user-9',
        user: makeMember('user-9', 'Someone Else'),
      } as any);

      const data = await (
        await action(
          actionArgs({ sleeperOwnerID: 'owner-2', userId: 'user-1' }),
        )
      ).json();

      expect(data.status).toBe('error');
      expect(data.message).toContain('Someone Else');
      expect(sleeperUserModel.matchSleeperOwnerToUser).not.toHaveBeenCalled();
    });
  });
});
