import { redirect } from '@remix-run/node';

/**
 * Sends a moved section on to its new address for good, keeping the rest of
 * the path and the query string, so links shared in Discord still land on
 * the same page. Throws, like the other loader guards.
 *
 * @param from - the old prefix, e.g. `/games/guillotine`
 * @param to - the new prefix, e.g. `/side-leagues/guillotine`
 */
export function redirectPrefix(request: Request, from: string, to: string) {
  const url = new URL(request.url);
  const rest = url.pathname.startsWith(from)
    ? url.pathname.slice(from.length)
    : '';
  throw redirect(`${to}${rest}${url.search}`, 301);
}
