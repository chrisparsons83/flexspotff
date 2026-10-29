import type { LoaderFunctionArgs } from '@remix-run/node';
import { Outlet, useRouteError } from '@remix-run/react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import {
  AdminShell,
  type AdminRole,
  adminNavFor,
  adminPageLabel,
} from '~/components/ui/admin-shell';
import { PageHeader } from '~/components/ui/page-header';
import {
  authenticator,
  isAdmin,
  isPodcastEditor,
  requireEditor,
} from '~/services/auth.server';
import { errorPage } from '~/utils/error-page';
import type { RouteHandle } from '~/utils/route-handle';

/** Every admin page is named after its link in the admin navigation. */
export const handle: RouteHandle = {
  title: ({ pathname }) => {
    const label = adminPageLabel(pathname);
    return !label || label === 'Admin Home' ? 'Admin' : `${label} - Admin`;
  },
};

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
  const { title, message, detail } = errorPage(error);

  return (
    <>
      <PageHeader title={title} description={message} />
      {detail && <p className='font-mono text-sm'>{detail}</p>}
    </>
  );
}
