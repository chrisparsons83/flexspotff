import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import SeasonLeaders from '~/components/layout/games/SeasonLeaders';
import { Button } from '~/components/ui/button';
import { Link } from '~/components/ui/link';
import { Section } from '~/components/ui/section';
import { getSeasonLeaders } from '~/libs/games/history.server';
import { getEntryByUserAndYear } from '~/models/fsquared.server';
import { fSquaredSeasonTotals } from '~/models/profile/sideGameSeasons.server';
import { getCurrentSeason } from '~/models/season.server';
import { authenticator } from '~/services/auth.server';

/** How many of this season's leaders the overview lists. */
const LEADERS = 10;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const [season, user] = await Promise.all([
    getCurrentSeason(),
    authenticator.isAuthenticated(request),
  ]);
  if (!season) throw new Response('No season set up yet', { status: 404 });

  const [existingEntry, totals] = await Promise.all([
    user ? getEntryByUserAndYear(user.id, season.year) : null,
    fSquaredSeasonTotals([season.year]),
  ]);

  return typedjson({
    year: season.year,
    isOpen: season.isOpenForFSquared,
    signedIn: !!user,
    hasEntry: !!existingEntry,
    leaders: await getSeasonLeaders(totals, season.year, LEADERS),
  });
};

export default function FSquaredOverview() {
  const { year, isOpen, signedIn, hasEntry, leaders } =
    useTypedLoaderData<typeof loader>();

  return (
    <>
      <Section
        title='Your Entry'
        description={
          !signedIn
            ? 'Log in to make an entry.'
            : hasEntry
            ? 'You have an entry in this season.'
            : 'You have not entered this season.'
        }
      >
        {signedIn && isOpen && (
          <Button asChild>
            <Link to='entries' variant='quiet'>
              {hasEntry ? 'Change your entry' : 'Make your entry'}
            </Link>
          </Button>
        )}
        {!isOpen && (
          <p className='text-muted-foreground'>Entries are closed.</p>
        )}
      </Section>
      <SeasonLeaders
        year={year}
        leaders={leaders}
        standingsPath='standings'
        valueHeading='Points'
      />
    </>
  );
}
