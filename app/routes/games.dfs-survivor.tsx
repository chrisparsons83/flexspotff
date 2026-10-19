import { Outlet } from '@remix-run/react';
import GameHeader from '~/components/layout/games/GameHeader';

export default function DfsSurvivor() {
  return (
    <>
      <GameHeader title='DFS survivor' tabs={{ base: '/games/dfs-survivor' }} />
      <Outlet />
    </>
  );
}
