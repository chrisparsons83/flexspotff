import { action, loader } from './admin.members.merge';
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '~/models/user.server';
import * as userModel from '~/models/user.server';
import * as userMergeModel from '~/models/userMerge.server';
import * as auth from '~/services/auth.server';

vi.mock('~/services/auth.server', () => ({
  authenticator: {
    isAuthenticated: vi.fn(),
  },
  requireAdmin: vi.fn(),
}));
vi.mock('~/models/user.server');
vi.mock('~/models/userMerge.server', async () => {
  const actual = await vi.importActual<typeof userMergeModel>(
    '~/models/userMerge.server',
  );
  return {
    // MergeGuardError has to stay real - the action branches on instanceof.
    MergeGuardError: actual.MergeGuardError,
    planUserMerge: vi.fn(),
    mergeUsers: vi.fn(),
    findDuplicateCandidates: vi.fn(),
    getMergedUsersWithLeftovers: vi.fn(),
  };
});
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

const mockPlan = {
  duplicate: {
    id: 'dup',
    discordId: 'd-dup',
    discordName: 'Panda',
    mergedIntoId: null,
  },
  canonical: {
    id: 'canon',
    discordId: 'd-canon',
    discordName: 'pandabair',
    mergedIntoId: null,
  },
  tables: [],
  tombstonesToRepoint: [],
  warnings: [],
  totalMoving: 3,
  totalStaying: 0,
};

const postForm = (fields: Record<string, string>) =>
  action({
    request: new Request('http://test/admin/members/merge', {
      method: 'POST',
      body: new URLSearchParams(fields),
    }),
    params: {},
    context: {},
  } as ActionFunctionArgs);

describe('admin.members.merge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-expect-error - Mocking narrower type (User) than actual (User | null)
    vi.mocked(auth.authenticator.isAuthenticated).mockResolvedValue(mockUser);
    vi.mocked(auth.requireAdmin).mockReturnValue(true);
    vi.mocked(userModel.getUsers).mockResolvedValue([]);
    vi.mocked(userMergeModel.findDuplicateCandidates).mockResolvedValue([]);
    vi.mocked(userMergeModel.getMergedUsersWithLeftovers).mockResolvedValue([]);
    vi.mocked(userMergeModel.planUserMerge).mockResolvedValue(mockPlan);
    vi.mocked(userMergeModel.mergeUsers).mockResolvedValue(mockPlan);
  });

  it('requires an admin on the loader', async () => {
    await loader({
      request: new Request('http://test/admin/members/merge'),
      params: {},
      context: {},
    } as LoaderFunctionArgs);

    expect(auth.requireAdmin).toHaveBeenCalledWith(mockUser);
  });

  it('requires an admin on the action', async () => {
    // The admin layout only requires an editor, and layout loaders do not
    // guard child actions, so this route has to check for itself.
    await postForm({
      _action: 'preview',
      duplicateId: 'dup',
      canonicalId: 'canon',
    });

    expect(auth.requireAdmin).toHaveBeenCalledWith(mockUser);
  });

  it('previews without merging anything', async () => {
    const response = await postForm({
      _action: 'preview',
      duplicateId: 'dup',
      canonicalId: 'canon',
    });

    expect(await response.json()).toMatchObject({ kind: 'preview' });
    expect(userMergeModel.mergeUsers).not.toHaveBeenCalled();
  });

  it('merges and reports what moved', async () => {
    const response = await postForm({
      _action: 'merge',
      duplicateId: 'dup',
      canonicalId: 'canon',
    });

    expect(userMergeModel.mergeUsers).toHaveBeenCalledWith(
      'dup',
      'canon',
      'user-admin',
    );
    expect(await response.json()).toMatchObject({
      kind: 'result',
      status: 'success',
    });
  });

  it('reports a missing selection instead of throwing', async () => {
    const response = await postForm({ _action: 'preview', duplicateId: 'dup' });

    expect(await response.json()).toMatchObject({
      kind: 'result',
      status: 'error',
      message: 'Pick the member to merge them into.',
    });
  });

  it('turns a refused merge into a message, not a 500', async () => {
    vi.mocked(userMergeModel.mergeUsers).mockRejectedValue(
      new userMergeModel.MergeGuardError(
        "A member can't be merged into themselves.",
      ),
    );

    const response = await postForm({
      _action: 'merge',
      duplicateId: 'dup',
      canonicalId: 'dup',
    });

    expect(await response.json()).toMatchObject({
      kind: 'result',
      status: 'error',
      message: "A member can't be merged into themselves.",
    });
  });

  it('asks for a fresh preview when the data moved underneath it', async () => {
    vi.mocked(userMergeModel.mergeUsers).mockRejectedValue(
      Object.assign(new Error('unique violation'), { code: 'P2002' }),
    );

    const response = await postForm({
      _action: 'merge',
      duplicateId: 'dup',
      canonicalId: 'canon',
    });

    expect(await response.json()).toMatchObject({
      kind: 'result',
      status: 'error',
      message: expect.stringContaining('run the preview again'),
    });
  });
});
