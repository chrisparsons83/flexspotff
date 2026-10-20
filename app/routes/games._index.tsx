import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import { Link } from '~/components/ui/link';
import { PageHeader } from '~/components/ui/page-header';
import { Table } from '~/components/ui/table';
import { getGamesThisWeek } from '~/libs/games/this-week.server';
import { getCurrentSeason } from '~/models/season.server';
import { authenticator } from '~/services/auth.server';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = { title: 'Games' };

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const [season, user] = await Promise.all([
    getCurrentSeason(),
    authenticator.isAuthenticated(request),
  ]);
  return typedjson({
    signedIn: !!user,
    games: await getGamesThisWeek(season),
  });
};

export default function Games() {
  const { signedIn, games } = useTypedLoaderData<typeof loader>();

  return (
    <>
      <PageHeader
        title='Games'
        description='Pick’em, streaming and survivor games, plus the Omni archive.'
      />
      <Table
        headers={['Game', 'This week', ...(signedIn ? ['Your entry'] : [])]}
        primaryColumns={[1]}
      >
        {games.map(game => (
          <tr key={game.to}>
            <td className='font-semibold'>
              <Link to={game.to} variant='quiet'>
                {game.name}
              </Link>
            </td>
            <td className='text-muted-foreground'>{game.status}</td>
            {signedIn && (
              <td>
                {game.entries && (
                  <Link to={`${game.to}/entries`}>My entries</Link>
                )}
              </td>
            )}
          </tr>
        ))}
      </Table>
    </>
  );
}
