import type { LoaderFunctionArgs } from '@remix-run/node';
import { Outlet } from '@remix-run/react';
import GameHeader from '~/components/layout/games/GameHeader';
import { requireSurvivorAccess } from '~/libs/survivor/access.server';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = { title: 'Survivor' };

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireSurvivorAccess(request);
  return {};
};

export default function Survivor() {
  return (
    <>
      <GameHeader
        title='Survivor'
        description='Pick one NFL team to win each week, and never the same team twice. A loss or a missed pick and you’re out. Whoever lasts longest wins, and entries that go out in the same week share the win. When everyone is out, a new pool starts the next week.'
        // Organised by pool rather than by week, and played on Sleeper.
        tabs={{
          base: '/games/survivor',
          standings: false,
          entries: false,
          rules: false,
        }}
      />
      <Outlet />
    </>
  );
}
