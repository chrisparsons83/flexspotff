import type { LoaderFunctionArgs } from '@remix-run/node';
import { Outlet } from '@remix-run/react';
import { authenticator, requireAdmin } from '~/services/auth.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  return {};
};

export default function AdminDfsSurvivor() {
  return (
    <>
      <Outlet />
    </>
  );
} 