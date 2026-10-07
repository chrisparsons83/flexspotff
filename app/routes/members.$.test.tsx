import { loader } from './members.$';
import type { LoaderFunctionArgs } from '@remix-run/node';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '~/db.server';

vi.mock('~/db.server', () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));
// Signed in as an admin, who can always see profiles.
vi.mock('~/services/auth.server', () => ({
  authenticator: { isAuthenticated: async () => ({ id: 'viewer' }) },
  isAdmin: () => true,
}));

const findUser = vi.mocked(prisma.user.findUnique);

const runLoader = (path: string) =>
  loader({
    request: new Request(`http://test${path}`),
    params: { '*': path.replace('/members/', '') },
    context: {},
  } as unknown as LoaderFunctionArgs).catch((thrown: unknown) => thrown);

describe('old /members/:userId links', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('redirect to the member’s handle, keeping the tab', async () => {
    findUser.mockResolvedValue({
      handle: 'pandabair',
      mergedInto: null,
    } as never);

    const response = (await runLoader('/members/user-1/cup')) as Response;

    expect(findUser).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-1' } }),
    );
    expect(response.status).toBe(301);
    expect(response.headers.get('Location')).toBe('/u/pandabair/cup');
  });

  it('follow a merge to the member who absorbed the account', async () => {
    findUser.mockResolvedValue({
      handle: 'panda',
      mergedInto: { handle: 'pandabair' },
    } as never);

    const response = (await runLoader('/members/user-1')) as Response;

    expect(response.headers.get('Location')).toBe('/u/pandabair');
  });

  it('404 for a member who does not exist', async () => {
    findUser.mockResolvedValue(null);

    const response = (await runLoader('/members/nobody/league')) as Response;

    expect(response.status).toBe(404);
  });
});
