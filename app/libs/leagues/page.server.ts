import { redirect, type LoaderFunctionArgs } from '@remix-run/node';
import { getLeagueByYearAndName } from '~/models/league.server';
import { FIRST_YEAR, isLeagueName } from '~/utils/constants';

/**
 * Finds the league a page is for from its URL: /leagues/:year/:league, with
 * the league named in lower case. A capitalised name redirects to the
 * lower-case address; anything else is a 404.
 */
export async function requireLeague({
  params,
  request,
}: Pick<LoaderFunctionArgs, 'params' | 'request'>) {
  const year = Number(params.year);
  const name = params.league ?? '';
  // Links typed by hand often capitalise the league, as its name is written.
  if (name !== name.toLowerCase()) {
    const url = new URL(request.url);
    url.pathname = url.pathname.replace(`/${name}`, `/${name.toLowerCase()}`);
    throw redirect(url.pathname + url.search, 301);
  }
  if (!Number.isInteger(year) || year < FIRST_YEAR || !isLeagueName(name)) {
    throw new Response('League not found', { status: 404 });
  }
  const league = await getLeagueByYearAndName(year, name);
  if (!league) throw new Response('League not found', { status: 404 });
  return league;
}
