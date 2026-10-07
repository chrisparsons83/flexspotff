import { loader } from './me';
import type { LoaderFunctionArgs } from '@remix-run/node';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as access from '~/models/profile/access.server';
import type { User } from '~/models/user.server';
import * as auth from '~/services/auth.server';

vi.mock('~/services/auth.server', () => ({
  authenticator: {
    isAuthenticated: vi.fn(),
  },
}));
vi.mock('~/models/profile/access.server');

const member = { id: 'member-1' } as User;

const runLoader = () =>
  loader({
    request: new Request('http://test/me'),
    params: {},
    context: {},
  } as unknown as LoaderFunctionArgs);

describe('me loader', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(auth.authenticator.isAuthenticated).mockResolvedValue(member as never);
  });

  it('sends the member to their own profile', async () => {
    vi.mocked(access.canViewProfiles).mockResolvedValue(true);

    const response = await runLoader();

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('/members/member-1/league');
  });

  it('sends the member to registration while profiles are hidden from them', async () => {
    vi.mocked(access.canViewProfiles).mockResolvedValue(false);

    const response = await runLoader();

    expect(response.headers.get('Location')).toBe('/dashboard');
  });
});
