import { Outlet } from '@remix-run/react';
import GameHeader from '~/components/layout/games/GameHeader';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = { title: 'Locks challenge' };

export default function LocksChallenge() {
  return (
    <>
      <GameHeader
        title='Locks challenge'
        tabs={{ base: '/games/locks-challenge' }}
      />
      <Outlet />
    </>
  );
}
