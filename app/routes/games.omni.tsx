import { Outlet } from '@remix-run/react';
import type { RouteHandle } from '~/utils/route-handle';

/** Names Omni once, for its history and each season under it. */
export const handle: RouteHandle = { title: 'Omni' };

export default function OmniLayout() {
  return <Outlet />;
}
