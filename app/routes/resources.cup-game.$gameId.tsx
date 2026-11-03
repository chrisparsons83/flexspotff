import type { LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { getCupGameLineups } from '~/libs/cup/lineups.server';

/**
 * A cup game's lineups, loaded when someone opens the game. A missing game
 * comes back empty rather than thrown, so a stale bracket shows a message in
 * the dialog instead of swapping the whole page for an error.
 */
export const loader = async ({ params }: LoaderFunctionArgs) => {
  const lineups = await getCupGameLineups(params.gameId ?? '');
  return json(lineups, { status: lineups ? 200 : 404 });
};
