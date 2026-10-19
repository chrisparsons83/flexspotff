import { Outlet } from '@remix-run/react';
import GameHeader from '~/components/layout/games/GameHeader';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = { title: 'Spread pool' };

export default function SpreadPool() {
  return (
    <>
      <GameHeader title='Spread pool' tabs={{ base: '/games/spread-pool' }} />
      <Outlet />
    </>
  );
}
