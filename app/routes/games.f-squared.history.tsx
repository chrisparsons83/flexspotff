import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import GameHistory from '~/components/layout/games/GameHistory';
import { getGameHistory } from '~/libs/games/history.server';
import { fSquaredSeasonTotals } from '~/models/profile/sideGameSeasons.server';

export const loader = async () =>
  typedjson({ history: await getGameHistory(await fSquaredSeasonTotals()) });

export default function FSquaredHistory() {
  const { history } = useTypedLoaderData<typeof loader>();
  return (
    <GameHistory
      history={history}
      standingsPath='/games/f-squared/standings'
      valueHeading='Points'
    />
  );
}
