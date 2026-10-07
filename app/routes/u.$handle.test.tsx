import { loader } from './u.$handle';
import type { LoaderFunctionArgs } from '@remix-run/node';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '~/db.server';
import { getProfileSummary } from '~/models/profile/summary.server';

vi.mock('~/db.server', () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));
// Signed in as an admin, who can always see profiles.
vi.mock('~/services/auth.server', () => ({
  authenticator: { isAuthenticated: async () => ({ id: 'viewer' }) },
  isAdmin: () => true,
}));
vi.mock('~/models/profile/summary.server');

const findUser = vi.mocked(prisma.user.findUnique);

const runLoader = (handle: string, path = `/u/${handle}/league`) =>
  loader({
    request: new Request(`http://test${path}`),
    params: { handle },
    context: {},
  } as unknown as LoaderFunctionArgs).catch((thrown: unknown) => thrown);

describe('u.$handle loader', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('loads the profile of the member with that handle', async () => {
    findUser.mockResolvedValue({ id: 'user-1', mergedInto: null } as never);
    vi.mocked(getProfileSummary).mockResolvedValue({ user: {} } as never);

    await runLoader('pandabair');

    expect(findUser).toHaveBeenCalledWith(
      expect.objectContaining({ where: { handle: 'pandabair' } }),
    );
    expect(getProfileSummary).toHaveBeenCalledWith('user-1');
  });

  it('sends a merged-away handle to the canonical member, same tab', async () => {
    findUser.mockResolvedValue({
      id: 'user-dup',
      mergedInto: { handle: 'pandabair' },
    } as never);

    const response = (await runLoader('panda', '/u/panda/cup')) as Response;

    expect(response.status).toBe(301);
    expect(response.headers.get('Location')).toBe('/u/pandabair/cup');
    expect(getProfileSummary).not.toHaveBeenCalled();
  });

  it('404s for a handle nobody has', async () => {
    findUser.mockResolvedValue(null);

    const response = (await runLoader('nobody')) as Response;

    expect(response.status).toBe(404);
  });

  it('sends a capitalized handle to the lowercase one, same tab', async () => {
    findUser.mockResolvedValue({ id: 'user-1', mergedInto: null } as never);

    const response = (await runLoader(
      'PandaBair',
      '/u/PandaBair/cup',
    )) as Response;

    expect(findUser).toHaveBeenCalledWith(
      expect.objectContaining({ where: { handle: 'pandabair' } }),
    );
    expect(response.status).toBe(301);
    expect(response.headers.get('Location')).toBe('/u/pandabair/cup');
  });
});
