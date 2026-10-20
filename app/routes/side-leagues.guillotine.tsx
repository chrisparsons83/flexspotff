import type { LoaderFunctionArgs } from '@remix-run/node';
import { Outlet } from '@remix-run/react';
import { requireGuillotineAccess } from '~/libs/guillotine/access.server';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = { title: 'Guillotine' };

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireGuillotineAccess(request);
  return {};
};

export default function GamesGuillotine() {
  return <Outlet />;
}
