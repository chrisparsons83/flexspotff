import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import GameHistory from '~/components/layout/games/GameHistory';
import { getGameHistory } from '~/libs/games/history.server';
import { spreadPoolSeasonTotals } from '~/models/profile/sideGameSeasons.server';
import { STARTING_BANK } from '~/models/profile/spreadPoolProfile';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = { title: 'History' };

export const loader = async () =>
  typedjson({ history: await getGameHistory(await spreadPoolSeasonTotals()) });

export default function SpreadPoolHistory() {
  const { history } = useTypedLoaderData<typeof loader>();
  return (
    <GameHistory
      history={history}
      standingsPath='/games/spread-pool/standings'
      valueHeading='Bank'
      formatValue={net => `${STARTING_BANK + net}`}
    />
  );
}
