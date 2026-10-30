import type { LoaderFunctionArgs } from '@remix-run/node';
import type { ReactNode } from 'react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import CareerCard, { MiniStat } from '~/components/layout/profile/CareerCard';
import { Button } from '~/components/ui/button';
import { ExternalLink, Link } from '~/components/ui/link';
import { PageHeader } from '~/components/ui/page-header';
import { Section } from '~/components/ui/section';
import { SummaryRows } from '~/components/ui/summary-card';
import type { DashboardRow } from '~/libs/dashboard/week';
import { getMemberWeek } from '~/libs/dashboard/week.server';
import { getLastWeeks } from '~/libs/games/last-week.server';
import {
  type GameOverview,
  getGamesOverview,
} from '~/libs/games/overview.server';
import { getCurrentSeason } from '~/models/season.server';
import { authenticator } from '~/services/auth.server';
import { cn } from '~/utils';
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
  // Loaded once for both the leaders and the reader's own row.
  const lastWeeks = season ? await getLastWeeks(season.year) : undefined;
  const [games, member] = await Promise.all([
    getGamesOverview(season, {
      signedIn: !!user,
      leaders: LEADERS,
      weekLeaders: WEEK_LEADERS,
      lastWeeks,
    }),
    user && season ? getMemberWeek(user.id, season, { lastWeeks }) : null,
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
      <div>
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
 * One game: a section with its week and how to enter it, then three panels
 * side by side: the top of its newest week, the top of its season, and how
 * the reader is doing.
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
  // As many columns as panels, so a signed-out reader has no empty one.
  const panels = (game.lastWeek !== undefined ? 1 : 0) + 1 + (mine ? 1 : 0);

  return (
    <Section
      title={game.name}
      to={game.to}
      action={action}
      description={
        (game.status || game.statusLink) && (
          <>
            {game.status}
            {game.statusLink && (
              <>
                {game.status && ' '}
                <ExternalLink href={game.statusLink.href} target='_blank'>
                  {game.statusLink.label}
                </ExternalLink>
              </>
            )}
          </>
        )
      }
    >
      <div className={cn('grid gap-3', PANEL_COLUMNS[panels])}>
        {game.lastWeek !== undefined && (
          <Panel
            title={game.lastWeek ? `Week ${game.lastWeek.week}` : 'Last Week'}
          >
            {game.lastWeek && game.lastWeek.rows.length > 0 ? (
              <SummaryRows rows={game.lastWeek.rows} />
            ) : (
              <Empty>No week scored yet.</Empty>
            )}
          </Panel>
        )}
        <Panel title='Season'>
          {game.rows.length > 0 ? (
            <SummaryRows rows={game.rows} />
          ) : (
            <Empty>{game.empty}</Empty>
          )}
        </Panel>
        {mine && (
          <CareerCard
            title='You'
            lead={mine.standing ?? '–'}
            leadNote={mine.season ? `${mine.season} this season` : undefined}
          >
            {mine.lastWeek && (
              <MiniStat
                label='Last Week'
                value={mine.lastWeek}
                detail={mine.lastWeekPlace}
              />
            )}
          </CareerCard>
        )}
      </div>
    </Section>
  );
}

const PANEL_COLUMNS: Record<number, string> = {
  1: 'md:grid-cols-1',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
};

/** A lighter compartment of a game's section, as the career cards are. */
function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className='min-w-0 bg-secondary p-4 md:p-5'>
      <h4 className='m-0 mb-2 text-sm font-semibold text-muted-foreground'>
        {title}
      </h4>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className='py-1 text-sm text-muted-foreground'>{children}</p>;
}
