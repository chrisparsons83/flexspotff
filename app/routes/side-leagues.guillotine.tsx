import type { LoaderFunctionArgs } from '@remix-run/node';
import { Outlet } from '@remix-run/react';
import { requireGuillotineAccess } from '~/libs/guillotine/access.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireGuillotineAccess(request);
  return {};
};

export default function GamesGuillotine() {
  return <Outlet />;
}
