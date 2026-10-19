import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import { Link } from '~/components/ui/link';
import { PageHeader } from '~/components/ui/page-header';
import { Table } from '~/components/ui/table';
import { prisma } from '~/db.server';
import { poolTitle } from '~/libs/survivor/views';
import { getLocksWeeksByYear } from '~/models/locksweek.server';
import { getPoolWeeksByYear } from '~/models/poolweek.server';
import { getQBStreamingWeeks } from '~/models/qbstreamingweek.server';
import { getCurrentSeason } from '~/models/season.server';
import { getLatestSurvivorPools } from '~/models/survivor.server';
import { authenticator } from '~/services/auth.server';

type WeekState = { week: number; isOpen: boolean; isScored: boolean };

/** Where a weekly game stands, in a few words. */
const weekStatus = (state: WeekState | null) =>
  !state
    ? 'No weeks yet'
    : state.isScored
    ? `Week ${state.week} scored`
    : state.isOpen
    ? `Week ${state.week} open for picks`
    : `Week ${state.week} not open yet`;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const [season, user] = await Promise.all([
    getCurrentSeason(),
    authenticator.isAuthenticated(request),
  ]);
  const year = season?.year;

  const [qb, pool, locks, dfs, survivor] = await Promise.all([
    year ? getQBStreamingWeeks(year) : [],
    year ? getPoolWeeksByYear(year) : [],
    year ? getLocksWeeksByYear(year) : [],
    year
      ? prisma.dFSSurvivorUserWeek.findFirst({
          where: { year, isScored: true },
          orderBy: { week: 'desc' },
          select: { week: true },
        })
      : null,
    getLatestSurvivorPools(),
  ]);

  const qbWeek = qb[0];
  const poolWeek = pool.find(week => week.isOpen) ?? pool[0];
  const locksWeek = locks.find(week => week.isOpen) ?? locks[0];

  return typedjson({
    signedIn: !!user,
    games: [
      {
        name: 'QB streaming',
        to: '/games/qb-streaming',
        status: weekStatus(
          qbWeek
            ? {
                week: qbWeek.week,
                isOpen: qbWeek.isOpen,
                isScored: qbWeek.isScored,
              }
            : null,
        ),
        entries: true,
      },
      {
        name: 'Spread pool',
        to: '/games/spread-pool',
        status: weekStatus(
          poolWeek
            ? {
                week: poolWeek.weekNumber,
                isOpen: poolWeek.isOpen,
                isScored: poolWeek.isWeekScored,
              }
            : null,
        ),
        entries: true,
      },
      {
        name: 'Locks challenge',
        to: '/games/locks-challenge',
        status: weekStatus(
          locksWeek
            ? {
                week: locksWeek.weekNumber,
                isOpen: locksWeek.isOpen,
                isScored: locksWeek.isWeekScored,
              }
            : null,
        ),
        entries: true,
      },
      {
        name: 'DFS survivor',
        to: '/games/dfs-survivor',
        status: dfs ? `Scored through week ${dfs.week}` : 'No weeks scored yet',
        entries: true,
      },
      {
        name: 'F²',
        to: '/games/f-squared',
        status: season?.isOpenForFSquared ? 'Entries open' : 'Entries closed',
        entries: true,
      },
      {
        name: 'Survivor',
        to: '/games/survivor',
        status:
          survivor.length > 0
            ? survivor.map(pool => poolTitle(pool)).join(', ')
            : 'No pools yet',
        entries: false,
      },
      {
        name: 'Omni',
        to: '/games/omni',
        status: 'Past seasons. Omni now runs on Brackt.',
        entries: false,
      },
    ],
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
