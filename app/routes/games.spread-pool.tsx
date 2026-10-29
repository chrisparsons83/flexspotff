import { Outlet } from '@remix-run/react';
import GameHeader from '~/components/layout/games/GameHeader';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = { title: 'Spread Pool' };

export default function SpreadPool() {
  return (
    <>
      <GameHeader
        title='Spread Pool'
        description='Start the season with 1000 points and bet them on NFL games against the spread. The biggest bank at the end of week 17 wins.'
        tabs={{ base: '/games/spread-pool' }}
      />
      <Outlet />
    </>
  );
}
