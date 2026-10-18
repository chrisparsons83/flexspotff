import { Outlet } from '@remix-run/react';
import GameHeader from '~/components/layout/games/GameHeader';

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
