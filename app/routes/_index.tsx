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

/** How many of each table the home page shows. */
const LEADERS = 3;

/** The league calendar from the rules: sections 9 and 13. */
const LAST_REGULAR_SEASON_WEEK = 14;
const LAST_PLAYOFF_WEEK = 17;

/** Where the leagues are in their season, in a sentence. */
const leagueWeek = (week: number) =>
  week <= LAST_REGULAR_SEASON_WEEK
    ? `Week ${week} of ${LAST_REGULAR_SEASON_WEEK} in the regular season.`
    : week <= LAST_PLAYOFF_WEEK
    ? `Playoffs, week ${week} of ${LAST_PLAYOFF_WEEK}.`
    : 'The regular season and playoffs are over.';

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
    season ? getSideLeaguesOverview({ signedIn, leaders: LEADERS }) : null,
  ]);

  return typedjson({
    year: season?.year ?? null,
    week,
    signedIn,
    // The Omni archive has no week to report.
    games: games.filter(game => game.to !== '/games/omni'),
    // Named for the home page, where the section is not in the title.
    sideLeagues: sideLeagues && [
      ...(sideLeagues.guillotine?.leagues ?? []),
      ...(sideLeagues.d12 ? [{ ...sideLeagues.d12, title: 'D12' }] : []),
      ...(sideLeagues.bestBall
        ? [{ ...sideLeagues.bestBall, title: 'Autodraft BBM' }]
        : []),
    ],
    leagues: leagues.map(league => ({
      id: league.id,
      name: league.name,
      leaders: league.teams.slice(0, LEADERS).map(team => ({
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
                Your week
              </Link>
            </Button>
          ) : (
            <Button asChild>
              <a href={DISCORD_INVITE}>Join the Discord</a>
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
              ? `${year}, week ${week}`
              : `${year} leagues`
          }
          description={`${
            week ? `${leagueWeek(week)} ` : ''
          }The top of each league’s table.`}
          action={<Link to='/leagues/standings'>Full standings</Link>}
        >
          <div className='grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5'>
            {leagues.map(league => {
              const fill = leagueFill(league.name) ?? undefined;
              return (
                <Card key={league.id} league={fill}>
                  <CardHeader>
                    <CardTitle>
                      <Link
                        to={`/leagues/${year}/${league.name.toLowerCase()}`}
                        variant='quiet'
                      >
                        {league.name}
                      </Link>
                    </CardTitle>
                  </CardHeader>
                  <ol className='px-5 py-2'>
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
        <Section
          title='Games this week'
          description='Where each game’s week stands, and the top of its table.'
          action={<Link to='/games'>All games</Link>}
        >
          <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-3'>
            {games.map(game => (
              <SummaryCard
                key={game.to}
                title={game.name}
                to={game.to}
                status={game.status}
                rows={game.rows}
                empty={game.empty}
              />
            ))}
          </div>
        </Section>
      )}

      {sideLeagues && sideLeagues.length > 0 && (
        <Section
          title='Side leagues'
          action={<Link to='/side-leagues'>All side leagues</Link>}
        >
          <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-4'>
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
