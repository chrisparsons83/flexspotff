import type { LoaderFunctionArgs } from '@remix-run/node';
import { redirect } from '@remix-run/node';
import { canViewProfiles } from '~/models/profile/access.server';
import { authenticator } from '~/services/auth.server';

/**
 * Where login lands: the member's own profile. While profiles are still behind
 * the memberProfiles flag, members who cannot open them go to registration
 * instead of a 404.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });

  if (!(await canViewProfiles(user))) return redirect('/dashboard');

  return redirect(`/members/${user.id}/league`);
};
