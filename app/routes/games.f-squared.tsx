import { Outlet } from '@remix-run/react';
import GameHeader from '~/components/layout/games/GameHeader';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = { title: 'F²' };

export default function FSquared() {
  return (
    <>
      <GameHeader
        title='F²'
        description='Pick two teams from each league before they draft. Get points based on how many fantasy points they earn during the season. Most combined points wins.'
        // The rules page is written in the content pass (#196).
        tabs={{ base: '/games/f-squared', rules: false }}
      />
      <Outlet />
    </>
  );
}
