import { Outlet } from '@remix-run/react';
import GameHeader from '~/components/layout/games/GameHeader';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = { title: 'Locks Challenge' };

export default function LocksChallenge() {
  return (
    <>
      <GameHeader
        title='Locks Challenge'
        description='Pick as many winners as you like each week. If every one of them wins, you score a point for each; if any of them loses, the week scores nothing.'
        tabs={{ base: '/games/locks-challenge' }}
      />
      <Outlet />
    </>
  );
}
