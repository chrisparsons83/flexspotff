import { ChevronRightIcon, DiscordLogoIcon } from '@radix-ui/react-icons';
import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import MemberName from '~/components/ui/MemberName';
import { DISCORD_INVITE } from '~/components/ui/app-shell';
import { Button } from '~/components/ui/button';
import { Card, CardHeader, CardTitle } from '~/components/ui/card';
import { EmptyState } from '~/components/ui/empty-state';
import { leagueFill } from '~/components/ui/fills';
import { Link } from '~/components/ui/link';
import { PageHeader } from '~/components/ui/page-header';
import { ProfileLink } from '~/components/ui/profile-link';
import { Section } from '~/components/ui/section';
import { SummaryCard } from '~/components/ui/summary-card';
import { WinLoss } from '~/components/ui/win-loss';
import { getGamesOverview } from '~/libs/games/overview.server';
import { getSideLeaguesOverview } from '~/libs/side-leagues/overview.server';
import { getLeaguesByYear } from '~/models/league.server';
import { getCurrentNflWeek } from '~/models/nflgame.server';
import { getCurrentSeason } from '~/models/season.server';
import { authenticator } from '~/services/auth.server';
import { cn } from '~/utils';

/** How many of each table the home page shows. */
const LEADERS = 3;

/**
 * Champions gets a card twice as tall as the other leagues, so it shows down
 * to the last playoff spot.
 */
const CHAMPIONS_LEADERS = 6;

/** The last playoff week, from section 13 of the rules. */
const LAST_PLAYOFF_WEEK = 17;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const [season, user] = await Promise.all([
    getCurrentSeason(),
    authenticator.isAuthenticated(request),
  ]);
  const signedIn = Boolean(user);
  const [leagues, week, games, sideLeagues] = await Promise.all([
    season ? getLeaguesByYear(season.year) : [],
    season ? getCurrentNflWeek(season.year, new Date()) : null,
    season ? getGamesOverview(season, { signedIn, leaders: LEADERS }) : [],
    season
      ? getSideLeaguesOverview({ leaders: LEADERS, guillotineEach: LEADERS })
      : null,
  ]);

  return typedjson({
    year: season?.year ?? null,
    week,
    signedIn,
    // The Omni archive has no week to report.
    games: games.filter(game => !game.to.startsWith('/games/omni')),
    // Named for the home page, where the section is not in the title.
    sideLeagues: sideLeagues && [
      ...(sideLeagues.guillotine?.leagues ?? []),
      ...(sideLeagues.d12 ? [{ ...sideLeagues.d12, title: 'D12' }] : []),
      ...(sideLeagues.bestBall
        ? [{ ...sideLeagues.bestBall, title: 'Autodraft Best Ball Mania' }]
        : []),
    ],
    leagues: leagues.map(league => ({
      id: league.id,
      name: league.name,
      leaders: league.teams
        .slice(0, league.name === 'Champions' ? CHAMPIONS_LEADERS : LEADERS)
        .map(team => ({
          id: team.id,
          user: team.user
            ? {
                id: team.user.id,
                discordName: team.user.discordName,
                discordUsername: team.user.discordUsername,
              }
            : null,
          wins: team.wins,
          losses: team.losses,
          ties: team.ties,
        })),
    })),
  });
};

export default function Index() {
  const { year, week, signedIn, games, leagues, sideLeagues } =
    useTypedLoaderData<typeof loader>();

  return (
    <>
      <PageHeader
        title='Flex Spot'
        description={
          <>
            A fantasy football Discord, around since 2016. We run promotion and
            relegation leagues with a cup across all of them, a set of weekly
            games and a few side leagues, and make awful football takes when we
            should probably be working.
          </>
        }
        actions={
          signedIn ? (
            <Button asChild>
              <Link to='/dashboard' variant='quiet'>
                Your dashboard
              </Link>
            </Button>
          ) : (
            <Button asChild variant='discord'>
              <a href={DISCORD_INVITE}>
                <DiscordLogoIcon aria-hidden />
                Join the Discord
              </a>
            </Button>
          )
        }
      />

      {!year && (
        <EmptyState title='The new season has not started yet'>
          Leagues, games and side leagues open here once it is set up.
        </EmptyState>
      )}

      {leagues.length > 0 && year && (
        <Section
          title={
            week && week <= LAST_PLAYOFF_WEEK
              ? `Week ${week}`
              : `${year} leagues`
          }
          to={
            week && week <= LAST_PLAYOFF_WEEK
              ? `/leagues/leaderboard/${year}/${week}`
              : '/leagues'
          }
          action={<Link to='/leagues/standings'>Full standings</Link>}
        >
          <div className='grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3'>
            {leagues.map(league => {
              const fill = leagueFill(league.name) ?? undefined;
              // Two rows tall beside the others, with its rows spread down it.
              const tall = league.name === 'Champions';
              return (
                <Card
                  key={league.id}
                  league={fill}
                  className={cn(tall && 'sm:row-span-2 sm:flex sm:flex-col')}
                >
                  <CardHeader>
                    <CardTitle>
                      <Link
                        to={`/leagues/${year}/${league.name.toLowerCase()}`}
                        variant='quiet'
                        className='inline-flex'
                      >
                        {league.name}
                        <ChevronRightIcon
                          aria-hidden
                          className='ml-1 size-5 self-center'
                        />
                      </Link>
                    </CardTitle>
                  </CardHeader>
                  <ol
                    className={cn(
                      'px-5 py-2',
                      tall && 'sm:flex sm:flex-1 sm:flex-col sm:justify-around',
                    )}
                  >
                    {league.leaders.map((leader, index) => (
                      <li
                        key={leader.id}
                        className='grid grid-cols-[1.5rem_1fr_auto] gap-2 py-2 text-sm'
                      >
                        <span className='text-muted-foreground'>
                          {index + 1}
                        </span>
                        <span className='truncate'>
                          {leader.user ? (
                            <ProfileLink userId={leader.user.id}>
                              <MemberName user={leader.user} />
                            </ProfileLink>
                          ) : (
                            'Unclaimed team'
                          )}
                        </span>
                        <span className='font-semibold'>
                          <WinLoss
                            wins={leader.wins}
                            losses={leader.losses}
                            ties={leader.ties}
                          />
                        </span>
                      </li>
                    ))}
                  </ol>
                </Card>
              );
            })}
          </div>
        </Section>
      )}

      {year && (
        <Section title='Games this week' to='/games'>
          <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-3'>
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
              />
            ))}
          </div>
        </Section>
      )}

      {sideLeagues && sideLeagues.length > 0 && (
        <Section title='Side leagues' to='/side-leagues'>
          <div className='grid gap-6 sm:grid-cols-2'>
            {sideLeagues.map(summary => (
              <SummaryCard
                key={summary.to}
                title={summary.title}
                to={summary.to}
                status={summary.status || undefined}
                rows={summary.rows}
                empty={summary.empty}
              />
            ))}
          </div>
        </Section>
      )}
    </>
  );
}
