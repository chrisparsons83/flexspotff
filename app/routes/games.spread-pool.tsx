import { Outlet } from '@remix-run/react';
import GameHeader from '~/components/layout/games/GameHeader';

export default function SpreadPool() {
  return (
    <>
      <GameHeader title='Spread pool' tabs={{ base: '/games/spread-pool' }} />
      <Outlet />
    </>
  );
}
