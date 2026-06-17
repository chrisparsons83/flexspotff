import { redirect } from '@remix-run/node';
import { getLatestD12Season } from '~/models/d12season.server';

export const loader = async () => {
  const season = await getLatestD12Season();
  if (season) {
    return redirect(`/games/d12/adp/${season.year}`);
  }
  return redirect('/games');
};
