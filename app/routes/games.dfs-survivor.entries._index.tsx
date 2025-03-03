import type { LoaderFunctionArgs } from '@remix-run/node';
import { getCurrentSeason } from '~/models/season.server';
import { authenticator } from '~/services/auth.server';

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
    <h2>
      Something went wrong
    </h2>
  );
}
