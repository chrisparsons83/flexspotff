import type { LoaderFunctionArgs } from '@remix-run/node';
//import { Link } from '@remix-run/react';
//import { typedjson, useTypedLoaderData } from 'remix-typedjson';
//import { getLocksWeeksByYear } from '~/models/locksweek.server';
import { getCurrentSeason } from '~/models/season.server';
import { authenticator } from '~/services/auth.server';
import DfsSurvivorWeekComponent from '~/components/layout/dfs-survivor/DfsSurvivorWeek';

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });

  let currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    throw new Error('No active season currently');
  }
  return null;
};

export default function GamesDfsSurvivorMyEntry() {

  return (
    <div className="md:grid md:grid-cols-3 md:gap-4">
        <DfsSurvivorWeekComponent />
        <DfsSurvivorWeekComponent />
        <DfsSurvivorWeekComponent />
        <DfsSurvivorWeekComponent />
        <DfsSurvivorWeekComponent />
        <DfsSurvivorWeekComponent />
    </div>
  );
}
