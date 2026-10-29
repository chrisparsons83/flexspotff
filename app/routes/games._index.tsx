import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import { Link } from '~/components/ui/link';
import { PageHeader } from '~/components/ui/page-header';
import { SummaryCard } from '~/components/ui/summary-card';
import { getGamesOverview } from '~/libs/games/overview.server';
import { getCurrentSeason } from '~/models/season.server';
import { authenticator } from '~/services/auth.server';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = { title: 'Games' };

/** How many of each game's leaders the overview lists. */
const LEADERS = 5;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const [season, user] = await Promise.all([
    getCurrentSeason(),
    authenticator.isAuthenticated(request),
  ]);
  return typedjson({
    signedIn: !!user,
    games: await getGamesOverview(season, {
      signedIn: !!user,
      leaders: LEADERS,
    }),
  });
};

export default function Games() {
  const { signedIn, games } = useTypedLoaderData<typeof loader>();

  return (
    <>
      <PageHeader title='Games' />
      <div className='grid gap-6 md:grid-cols-2 xl:grid-cols-3'>
        {games.map(game => (
          <SummaryCard
            key={game.to}
            title={game.name}
            to={game.to}
            status={game.status}
            statusHref={game.statusHref}
            statusLink={game.statusLink}
            rows={game.rows}
            empty={game.empty}
            footer={
              signedIn &&
              game.entries && <Link to={`${game.to}/entries`}>My Entries</Link>
            }
          />
        ))}
      </div>
    </>
  );
}
