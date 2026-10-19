import { Outlet } from '@remix-run/react';
import GameHeader from '~/components/layout/games/GameHeader';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = { title: 'DFS survivor' };

export default function DfsSurvivor() {
  return (
    <>
      <GameHeader
        title='DFS survivor'
        description='Set a lineup every week, but never the same player twice in a season. The most points through week 17 wins.'
        tabs={{ base: '/games/dfs-survivor' }}
      />
      <Outlet />
    </>
  );
}
