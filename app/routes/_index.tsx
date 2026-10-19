import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import MemberName from '~/components/ui/MemberName';
import { DISCORD_INVITE } from '~/components/ui/app-shell';
import { Button } from '~/components/ui/button';
import { Card, CardHeader, CardTitle } from '~/components/ui/card';
import { leagueFill } from '~/components/ui/fills';
import { Link } from '~/components/ui/link';
import { PageHeader } from '~/components/ui/page-header';
import { ProfileLink } from '~/components/ui/profile-link';
import { Section } from '~/components/ui/section';
import { WinLoss } from '~/components/ui/win-loss';
import { getLeaguesByYear } from '~/models/league.server';
import { getCurrentNflWeek } from '~/models/nflgame.server';
import { getCurrentSeason } from '~/models/season.server';
import { authenticator } from '~/services/auth.server';

/** How many of each league's table the home page shows. */
const LEADERS = 3;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const [season, user] = await Promise.all([
    getCurrentSeason(),
    authenticator.isAuthenticated(request),
  ]);
  const [leagues, week] = season
    ? await Promise.all([
        getLeaguesByYear(season.year),
        getCurrentNflWeek(season.year, new Date()),
      ])
    : [[], null];

  return typedjson({
    year: season?.year ?? null,
    week,
    signedIn: Boolean(user),
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
  const { year, week, signedIn, leagues } = useTypedLoaderData<typeof loader>();

  return (
    <>
      <PageHeader
        title={year && week ? `${year}, week ${week}` : 'Flex Spot'}
        description={
          <>
            We’re a fantasy football Discord community and have been around
            since 2016. We run a small promotion and relegation set of leagues,
            season-long side games, and make awful football takes when we
            probably should be working.
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

      {leagues.length > 0 && year && (
        <Section
          title='League leaders'
          description={`The top of each league’s table in ${year}.`}
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
    </>
  );
}
