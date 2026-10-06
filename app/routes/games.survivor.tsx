import type { LoaderFunctionArgs } from '@remix-run/node';
import { Outlet } from '@remix-run/react';
import { requireSurvivorAccess } from '~/libs/survivor/access.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireSurvivorAccess(request);
  return {};
};

export default function GamesSurvivor() {
  return <Outlet />;
}
