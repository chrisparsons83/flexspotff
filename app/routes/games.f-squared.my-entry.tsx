import { redirect } from '@remix-run/node';

/** My entry moved to My entries, the tab every game shares. */
export const loader = () => {
  throw redirect('/games/f-squared/entries', 301);
};
