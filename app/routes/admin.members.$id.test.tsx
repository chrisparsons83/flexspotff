import { loader } from './admin.members.$id';
import type { LoaderFunctionArgs } from '@remix-run/node';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
vi.mock('~/models/sleeperUser.server');
vi.mock('~/models/user.server');
vi.mock('~/db.server', () => ({
  prisma: {},
}));

const mockAdmin: User = {
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

const mockMember: User = { ...mockAdmin, id: 'member-1', discordName: 'Panda' };

const runLoader = () =>
  loader({
    request: new Request('http://test/admin/members/member-1'),
    params: { id: 'member-1' },
    context: {},
  } as unknown as LoaderFunctionArgs);

describe('admin.members.$id loader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-expect-error - Mocking narrower type (User) than actual (User | null)
    vi.mocked(auth.authenticator.isAuthenticated).mockResolvedValue(mockAdmin);
    vi.mocked(auth.requireAdmin).mockReturnValue(true);
    vi.mocked(userModel.getUser).mockResolvedValue(mockMember);
    vi.mocked(sleeperUserModel.getSleeperOwnerIdsByUserId).mockResolvedValue(
      [],
    );
  });

  it('requires an admin, checking the requester rather than the member', async () => {
    await runLoader();

    // The loader's own `user` is the member being edited, so the requester has
    // to be looked up separately - passing the wrong one here would let any
    // member's page authorize itself.
    expect(auth.requireAdmin).toHaveBeenCalledWith(mockAdmin);
  });

  it('loads the member and their Sleeper IDs', async () => {
    const response = await runLoader();

    expect(await response.json()).toMatchObject({
      user: { id: 'member-1', discordName: 'Panda' },
    });
  });

  it('does not read the member when authorization fails', async () => {
    vi.mocked(auth.requireAdmin).mockImplementation(() => {
      throw new Error('You do not have access to this page.');
    });

    await expect(runLoader()).rejects.toThrow('You do not have access');
    expect(userModel.getUser).not.toHaveBeenCalled();
  });
});
