import { useTypedLoaderData } from 'remix-typedjson';
import CupPage from '~/components/layout/cup/CupPage';
import { loadCupPage } from '~/libs/cup/bracket.server';
import { getCurrentSeason } from '~/models/season.server';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = { title: 'Cup' };

/** This season's cup. */
export const loader = async () => {
  const season = await getCurrentSeason();
  if (!season) throw new Response('No season set up yet', { status: 404 });
  return loadCupPage(season.year);
};

export default function CurrentCup() {
  return <CupPage {...useTypedLoaderData<typeof loader>()} />;
}
