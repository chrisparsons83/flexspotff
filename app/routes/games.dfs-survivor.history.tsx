import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import GameHistory from '~/components/layout/games/GameHistory';
import { getGameHistory } from '~/libs/games/history.server';
import { dfsSurvivorSeasonTotals } from '~/models/profile/sideGameSeasons.server';

export const loader = async () =>
  typedjson({ history: await getGameHistory(await dfsSurvivorSeasonTotals()) });

export default function DfsSurvivorHistory() {
  const { history } = useTypedLoaderData<typeof loader>();
  return (
    <GameHistory
      history={history}
      standingsPath='/games/dfs-survivor/standings'
      valueHeading='Points'
    />
  );
}
