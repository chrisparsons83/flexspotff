import type { LoaderFunctionArgs } from '@remix-run/node';
import { redirectPrefix } from '~/utils/redirects.server';

/** D12 moved from Games to Side leagues. */
export const loader = ({ request }: LoaderFunctionArgs) =>
  redirectPrefix(request, '/games/d12', '/side-leagues/d12');
