import { Outlet } from '@remix-run/react';
import GameHeader from '~/components/layout/games/GameHeader';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = { title: 'DFS survivor' };

export default function DfsSurvivor() {
  return (
    <>
      <GameHeader title='DFS survivor' tabs={{ base: '/games/dfs-survivor' }} />
      <Outlet />
    </>
  );
}
