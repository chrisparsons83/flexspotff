import type { LoaderFunctionArgs } from '@remix-run/node';
import { redirectPrefix } from '~/utils/redirects.server';

/** Autodraft BBM moved from Games to Side leagues. */
export const loader = ({ request }: LoaderFunctionArgs) =>
  redirectPrefix(request, '/games/best-ball', '/side-leagues/best-ball');
