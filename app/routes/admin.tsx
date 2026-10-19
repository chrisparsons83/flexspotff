import type { LoaderFunctionArgs } from '@remix-run/node';
import { Outlet, isRouteErrorResponse, useRouteError } from '@remix-run/react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import {
  AdminShell,
  type AdminRole,
  adminNavFor,
} from '~/components/ui/admin-shell';
import { PageHeader } from '~/components/ui/page-header';
import {
  authenticator,
  isAdmin,
  isPodcastEditor,
  requireEditor,
} from '~/services/auth.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });

  requireEditor(user);

  const [userIsAdmin, userIsPodcastEditor] = await Promise.all([
    isAdmin(user),
    isPodcastEditor(user),
  ]);

  return typedjson({ user, userIsAdmin, userIsPodcastEditor });
};

export default function Admin() {
  const { userIsAdmin, userIsPodcastEditor } =
    useTypedLoaderData<typeof loader>();
  const roles: AdminRole[] = [
    ...(userIsAdmin ? (['admin'] as const) : []),
    ...(userIsPodcastEditor ? (['podcast'] as const) : []),
  ];

  return (
    <>
      <PageHeader title='Admin' />
      <AdminShell groups={adminNavFor(roles)}>
        <Outlet />
      </AdminShell>
    </>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  console.error({ error });
  const message = isRouteErrorResponse(error)
    ? typeof error.data === 'string' && error.data
      ? error.data
      : `${error.status} ${error.statusText}`
    : error instanceof Error
    ? error.message
    : 'Unknown error';

  return <PageHeader title='Something went wrong' description={message} />;
}
