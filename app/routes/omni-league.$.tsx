import type { LoaderFunctionArgs } from '@remix-run/node';
import { redirect } from '@remix-run/node';

/**
 * Omni moved into Games as an archive. The old addresses map onto the new
 * ones, which order the year and the page differently.
 */
export const loader = ({ params }: LoaderFunctionArgs) => {
  const [first, second, third] = (params['*'] ?? '').split('/');
  const to =
    first === 'standings' && second
      ? `/games/omni/${second}`
      : first === 'qualifying-points' && second
      ? `/games/omni/${second}/qualifying-points${third ? `/${third}` : ''}`
      : /^\d{4}$/.test(first ?? '') && second === 'rules'
      ? `/games/omni/${first}/rules`
      : '/games/omni';
  throw redirect(to, 301);
};
