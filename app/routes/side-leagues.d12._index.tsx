import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import GameHistory from '~/components/layout/games/GameHistory';
import { getGameHistory } from '~/libs/games/history.server';
import { d12SeasonTotals } from '~/models/profile/sideGameSeasons.server';

/** Every D12 season with the top of its leaderboard, and its winners. */
export const loader = async () =>
  typedjson({ history: await getGameHistory(await d12SeasonTotals()) });

export default function D12History() {
  const { history } = useTypedLoaderData<typeof loader>();
  return (
    <GameHistory
      history={history}
      standingsPath='/side-leagues/d12'
      valueHeading='Points'
    />
  );
}
