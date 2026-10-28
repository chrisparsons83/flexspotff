import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import MemberName from '~/components/ui/MemberName';
import { Card, CardHeader, CardTitle } from '~/components/ui/card';
import { EmptyState } from '~/components/ui/empty-state';
import { leagueFill } from '~/components/ui/fills';
import { Link } from '~/components/ui/link';
import { ProfileLink } from '~/components/ui/profile-link';
import { Section } from '~/components/ui/section';
import { LeagueMark } from '~/components/ui/swatch';
import { Table } from '~/components/ui/table';
import { WinLoss } from '~/components/ui/win-loss';
import { getLeaguesByYear } from '~/models/league.server';
import { getCurrentSeason } from '~/models/season.server';
import {
  getNewestWeekTeamGameByYear,
  getTeamGamesByYearAndWeek,
} from '~/models/teamgame.server';

/** How many of the week's best scores the overview lists. */
const TOP_SCORES = 5;

export const loader = async () => {
  const season = await getCurrentSeason();
  if (!season) return typedjson({ year: null, leagues: [], week: null });

  const [leagues, newest] = await Promise.all([
    getLeaguesByYear(season.year),
    getNewestWeekTeamGameByYear(season.year),
  ]);
  const weekNumber = newest._max.week;
  const scores = weekNumber
    ? await getTeamGamesByYearAndWeek(season.year, weekNumber)
    : [];

  return typedjson({
    year: season.year,
    leagues,
    week: weekNumber
      ? {
          number: weekNumber,
          top: scores.slice(0, TOP_SCORES).map(game => ({
            id: game.id,
            user: game.team.user,
            league: game.team.league.name,
            points: game.pointsScored,
          })),
        }
      : null,
  });
};

export default function LeaguesOverview() {
  const { year, leagues, week } = useTypedLoaderData<typeof loader>();

  if (!year || leagues.length === 0) {
    return (
      <EmptyState title='No leagues set up for this season yet'>
        This season’s leagues appear here once they are drafted on Sleeper.
      </EmptyState>
    );
  }

  return (
    <>
      <Section
        title={`${year} leagues`}
        description={`${leagues.length} leagues in ${
          new Set(leagues.map(league => league.tier)).size
        } tiers. Each table is best first.`}
      >
        <div className='grid gap-6 md:grid-cols-2 xl:grid-cols-3'>
          {leagues.map(league => (
            <Card key={league.id} league={leagueFill(league.name) ?? undefined}>
              <CardHeader>
                <CardTitle>
                  <Link
                    to={`/leagues/${year}/${league.name.toLowerCase()}`}
                    variant='quiet'
                  >
                    {league.name}
                  </Link>
                </CardTitle>
                <span className='text-sm'>Tier {league.tier}</span>
              </CardHeader>
              <ol className='px-5 py-2'>
                {league.teams.map((team, index) => (
                  <li
                    key={team.id}
                    className='grid grid-cols-[1.5rem_1fr_auto] gap-2 py-1 text-sm'
                  >
                    <span className='text-muted-foreground'>{index + 1}</span>
                    <span className='truncate'>
                      {team.user ? (
                        <ProfileLink userId={team.user.id}>
                          <MemberName user={team.user} />
                        </ProfileLink>
                      ) : (
                        'Unclaimed team'
                      )}
                    </span>
                    <span className='font-semibold'>
                      <WinLoss
                        wins={team.wins}
                        losses={team.losses}
                        ties={team.ties}
                      />
                    </span>
                  </li>
                ))}
              </ol>
            </Card>
          ))}
        </div>
      </Section>

      {week && (
        <Section
          title={`Week ${week.number}`}
          description='The best scores of the week across every league.'
          action={
            <Link to={`/leagues/leaderboard/${year}/${week.number}`}>
              Week {week.number} leaderboard
            </Link>
          }
        >
          <Table
            headers={['Rank', 'Manager', 'League', 'Points']}
            numericColumns={[0, 3]}
          >
            {week.top.map((score, index) => (
              <tr key={score.id}>
                <td className='text-right text-muted-foreground'>
                  {index + 1}
                </td>
                <td>
                  {score.user ? (
                    <ProfileLink userId={score.user.id}>
                      <MemberName user={score.user} />
                    </ProfileLink>
                  ) : (
                    'Unclaimed team'
                  )}
                </td>
                <td>
                  <LeagueMark name={score.league} />
                </td>
                <td className='text-right'>{score.points.toFixed(2)}</td>
              </tr>
            ))}
          </Table>
        </Section>
      )}
    </>
  );
}
