import type { LoaderFunctionArgs } from '@remix-run/node';
import { Outlet } from '@remix-run/react';
import { requireBestBallAccess } from '~/libs/best-ball/access.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireBestBallAccess(request);
  return {};
};

export default function GamesBestBall() {
  return <Outlet />;
}
