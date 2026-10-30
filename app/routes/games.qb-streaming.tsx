import { Outlet } from '@remix-run/react';
import GameHeader from '~/components/layout/games/GameHeader';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = { title: 'QB Streaming' };

export default function QBStreaming() {
  return (
    <>
      <GameHeader
        title='QB Streaming'
        description='Each week, stream two low-rostered quarterbacks: one from a standard list and one from a deeper one. Your best 12 weeks make your season.'
        tabs={{ base: '/games/qb-streaming' }}
      />
      <Outlet />
    </>
  );
}
