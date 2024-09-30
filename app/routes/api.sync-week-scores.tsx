import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson } from 'remix-typedjson';
import {
  getNflState,
  syncNflGameWeek,
  syncSleeperWeeklyScores,
} from '~/libs/syncs.server';
import { getActiveNflGames } from '~/models/nflgame.server';
import { getCurrentSeason } from '~/models/season.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Security check, since this will likely be a cron job at the start (maybe trigger.dev?)
  const url = new URL(request.url);
  const apiKey = url.searchParams.get('apiKey');
  if (process.env.API_KEY !== apiKey) {
    throw new Response('Invalid request', {
      status: 403,
    });
  }

  // Get state of NFL
  const nflGameState = await getNflState();
  let currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    throw new Response('No active season currently', {
      status: 400,
    });
  }
  const activeGames = await getActiveNflGames();

  // If there are any active games in the system, let's get the scores
  if (activeGames._count.id > 0) {
    await syncSleeperWeeklyScores(
      currentSeason.year,
      nflGameState.display_week,
    );
  }

  // Finally let's get the current state of the games. This will mean we'll start scores at the
  // beginning a little late, but we should make sure we get the last set of scores for a team so
  // there aren't any stragglers.
  await syncNflGameWeek(currentSeason.year, [nflGameState.display_week]);

  return typedjson({ message: 'League games have been synced.' });
};
