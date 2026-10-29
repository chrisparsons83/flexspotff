import { Outlet } from '@remix-run/react';
import type { RouteHandle } from '~/utils/route-handle';

/** Names the entries once, for the list and each entry under it. */
export const handle: RouteHandle = { title: 'My entries' };

export default function LocksChallengeEntries() {
  return <Outlet />;
}
