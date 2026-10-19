import type { LoaderFunctionArgs } from '@remix-run/node';
import { Outlet } from '@remix-run/react';
import { PageHeader } from '~/components/ui/page-header';
import { SubNav } from '~/components/ui/sub-nav';
import { authenticator } from '~/services/auth.server';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = { title: 'Dashboard' };

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticator.isAuthenticated(request, { failureRedirect: '/login' });
  return null;
};

export default function Dashboard() {
  return (
    <>
      <PageHeader
        title='Dashboard'
        nav={
          <SubNav
            label='Dashboard'
            items={[
              { label: 'Your week', to: '/dashboard', end: true },
              { label: 'Registration', to: '/dashboard/registration' },
            ]}
          />
        }
      />
      <Outlet />
    </>
  );
}
