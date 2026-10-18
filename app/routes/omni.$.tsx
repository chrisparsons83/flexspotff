import type { LoaderFunctionArgs } from '@remix-run/node';
import { redirect } from '@remix-run/node';

/** The old Omni draft board, /omni/:year/board, now under Games. */
export const loader = ({ params }: LoaderFunctionArgs) => {
  const [year, page] = (params['*'] ?? '').split('/');
  throw redirect(
    /^\d{4}$/.test(year ?? '') && page === 'board'
      ? `/games/omni/${year}/draft`
      : '/games/omni',
    301,
  );
};
