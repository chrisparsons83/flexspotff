import { Outlet } from '@remix-run/react';
import GameHeader from '~/components/layout/games/GameHeader';

export default function QBStreaming() {
  return (
    <>
      <GameHeader title='QB streaming' tabs={{ base: '/games/qb-streaming' }} />
      <Outlet />
    </>
  );
}
