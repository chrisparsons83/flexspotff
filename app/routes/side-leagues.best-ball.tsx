import type { LoaderFunctionArgs } from '@remix-run/node';
import { Outlet } from '@remix-run/react';
import { requireBestBallAccess } from '~/libs/best-ball/access.server';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = { title: 'Autodraft BBM' };

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireBestBallAccess(request);
  return {};
};

export default function GamesBestBall() {
  return <Outlet />;
}
