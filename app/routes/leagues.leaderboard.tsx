import { Outlet } from '@remix-run/react';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = { title: 'Leaderboard' };

export default function Leaderboard() {
  return <Outlet />;
}
