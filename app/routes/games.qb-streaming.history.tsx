import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import GameHistory from '~/components/layout/games/GameHistory';
import { getGameHistory } from '~/libs/games/history.server';
import { qbStreamingSeasonTotals } from '~/models/profile/sideGameSeasons.server';

export const loader = async () =>
  typedjson({ history: await getGameHistory(await qbStreamingSeasonTotals()) });

export default function QBStreamingHistory() {
  const { history } = useTypedLoaderData<typeof loader>();
  return (
    <GameHistory
      history={history}
      standingsPath='/games/qb-streaming/standings'
      valueHeading='Points'
    />
  );
}
