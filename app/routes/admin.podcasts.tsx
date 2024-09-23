import type { LoaderFunctionArgs } from '@remix-run/node';
import { Outlet } from '@remix-run/react';
import { authenticator, requirePodcastEditor } from '~/services/auth.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requirePodcastEditor(user);

  return {};
};

export default function Podcasts() {
  return <Outlet />;
}
