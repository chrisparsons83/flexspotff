import { Outlet } from '@remix-run/react';
import type { RouteHandle } from '~/utils/route-handle';

/** Names the season once, for its own page and the weeks under it. */
export const handle: RouteHandle = {
  title: ({ params }) => `${params.year} season`,
};

export default function LeaderboardSeason() {
  return <Outlet />;
}
