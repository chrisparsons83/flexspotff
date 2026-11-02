import type { LoaderFunctionArgs } from '@remix-run/node';
import { redirectPrefix } from '~/utils/redirects.server';

/** Guillotine moved from Games to Side leagues. */
export const loader = ({ request }: LoaderFunctionArgs) =>
  redirectPrefix(request, '/games/guillotine', '/side-leagues/guillotine');
