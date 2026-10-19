import { Outlet } from '@remix-run/react';
import GameHeader from '~/components/layout/games/GameHeader';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = { title: 'QB streaming' };

export default function QBStreaming() {
  return (
    <>
      <GameHeader title='QB streaming' tabs={{ base: '/games/qb-streaming' }} />
      <Outlet />
    </>
  );
}
