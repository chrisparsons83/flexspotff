import { Outlet } from '@remix-run/react';
import GameHeader from '~/components/layout/games/GameHeader';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = { title: 'F²' };

export default function FSquared() {
  return (
    <>
      <GameHeader
        title='F²'
        description='Before each league drafts, pick two of its teams. Your score is the points every team you picked scores all season, and the highest total wins.'
        // The rules page is written in the content pass (#196).
        tabs={{ base: '/games/f-squared', rules: false }}
      />
      <Outlet />
    </>
  );
}
