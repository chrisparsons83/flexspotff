import { ChevronRightIcon } from '@radix-ui/react-icons';
import type { LoaderFunctionArgs } from '@remix-run/node';
import type { ReactNode } from 'react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import { Button } from '~/components/ui/button';
import { Card, CardHeader, CardTitle } from '~/components/ui/card';
import { ExternalLink, Link } from '~/components/ui/link';
import { PageHeader } from '~/components/ui/page-header';
import { SummaryRows } from '~/components/ui/summary-card';
import type { DashboardRow } from '~/libs/dashboard/week';
import { getMemberWeek } from '~/libs/dashboard/week.server';
import {
  type GameOverview,
  getGamesOverview,
} from '~/libs/games/overview.server';
import { getCurrentSeason } from '~/models/season.server';
import { authenticator } from '~/services/auth.server';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = { title: 'Games' };

/** How many of each game's season leaders, and of its last week, to list. */
const LEADERS = 5;
const WEEK_LEADERS = 3;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const [season, user] = await Promise.all([
    getCurrentSeason(),
    authenticator.isAuthenticated(request),
  ]);
  const [games, member] = await Promise.all([
    getGamesOverview(season, {
      signedIn: !!user,
      leaders: LEADERS,
      weekLeaders: WEEK_LEADERS,
    }),
    user && season ? getMemberWeek(user.id, season) : null,
  ]);
  return typedjson({
    games,
    // Their own row for each game, as the dashboard has it.
    mine: member?.rows.filter(row => row.section === 'Games') ?? [],
  });
};

export default function Games() {
  const { games, mine } = useTypedLoaderData<typeof loader>();

  return (
    <>
      <PageHeader
        title='Games'
        description='Weekly side games alongside the leagues: stream a quarterback, bet the spread, lock in winners, set a DFS lineup, pick a team from every league in F², and outlast everyone in Survivor.'
      />
      <div className='grid gap-6'>
        {games.map(game => (
          <GameRow
            key={game.to}
            game={game}
            // Survivor's row is per pool, under its own address.
            mine={mine.find(
              row => row.href === game.to || row.href.startsWith(`${game.to}/`),
            )}
          />
        ))}
      </div>
    </>
  );
}

/**
 * One game across the page: where its week stands and how to enter it, then
 * the top of its newest week, the top of its season, and how the reader is
 * doing.
 */
function GameRow({
  game,
  mine,
}: {
  game: GameOverview;
  mine: DashboardRow | undefined;
}) {
  // Open to them and not entered: the call to action. Open and entered:
  // a way back to change it.
  const action = mine?.enterHref ? (
    <Button asChild size='sm'>
      <Link to={mine.enterHref} variant='quiet'>
        Make Your Picks
      </Link>
    </Button>
  ) : game.statusHref ? (
    <Button asChild size='sm' variant='secondary'>
      <Link to={game.statusHref} variant='quiet'>
        Edit Your Picks
      </Link>
    </Button>
  ) : null;

  return (
    <Card className='min-w-0'>
      <CardHeader>
        <CardTitle>
          <Link to={game.to} variant='quiet' className='inline-flex'>
            {game.name}
            <ChevronRightIcon
              aria-hidden
              className='ml-1 size-5 self-center text-primary'
            />
          </Link>
        </CardTitle>
        {action}
      </CardHeader>
      {(game.status || game.statusLink) && (
        <p className='px-5 pt-3 text-sm text-muted-foreground'>
          {game.status}
          {game.statusLink && (
            <>
              {game.status && ' '}
              <ExternalLink href={game.statusLink.href} target='_blank'>
                {game.statusLink.label}
              </ExternalLink>
            </>
          )}
        </p>
      )}
      <div className='grid gap-6 px-5 pb-5 pt-4 md:grid-cols-3'>
        {game.lastWeek !== undefined && (
          <Column
            title={game.lastWeek ? `Week ${game.lastWeek.week}` : 'Last Week'}
          >
            {game.lastWeek && game.lastWeek.rows.length > 0 ? (
              <SummaryRows rows={game.lastWeek.rows} />
            ) : (
              <Empty>No week scored yet.</Empty>
            )}
          </Column>
        )}
        <Column title='Season'>
          {game.rows.length > 0 ? (
            <SummaryRows rows={game.rows} />
          ) : (
            <Empty>{game.empty}</Empty>
          )}
        </Column>
        {mine && (
          <Column title='You'>
            <dl className='m-0 grid gap-2 text-sm'>
              <Fact label='Standing' value={mine.standing} />
              {mine.season && <Fact label='Season' value={mine.season} />}
              {mine.lastWeek && (
                <Fact
                  label='Last Week'
                  value={
                    mine.lastWeekPlace
                      ? `${mine.lastWeek}, ${mine.lastWeekPlace}`
                      : mine.lastWeek
                  }
                />
              )}
            </dl>
          </Column>
        )}
      </div>
    </Card>
  );
}

function Column({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className='min-w-0'>
      <h4 className='mb-1 text-sm font-semibold text-muted-foreground'>
        {title}
      </h4>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className='py-1 text-sm text-muted-foreground'>{children}</p>;
}

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div className='flex justify-between gap-4'>
      <dt className='text-muted-foreground'>{label}</dt>
      <dd className='m-0 font-semibold tabular-nums'>{value ?? '–'}</dd>
    </div>
  );
}
