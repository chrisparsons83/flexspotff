import { loader as yearLoader } from './games.qb-streaming.standings.$year._index';
import type { LoaderFunctionArgs } from '@remix-run/node';
import { getCurrentSeason } from '~/models/season.server';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = { title: 'Standings' };

export { default } from './games.qb-streaming.standings.$year._index';

/** This season's standings, at the address without a year. */
export const loader = async (args: LoaderFunctionArgs) => {
  const season = await getCurrentSeason();
  if (!season) throw new Response('No season set up yet', { status: 404 });
  return yearLoader({
    ...args,
    params: { ...args.params, year: String(season.year) },
  });
};
