import { ChevronRightIcon } from '@radix-ui/react-icons';
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
import { cn } from '~/utils';

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
  const tiers = [
    ...leagues
      .reduce(
        (byTier, league) =>
          byTier.set(league.tier, [...(byTier.get(league.tier) ?? []), league]),
        new Map<number, typeof leagues>(),
      )
      .values(),
  ];

  if (!year || leagues.length === 0) {
    return (
      <EmptyState title='No leagues set up for this season yet'>
        This season’s leagues appear here once they are drafted on Sleeper.
      </EmptyState>
    );
  }

  return (
    <>
      <Section title={`${year} Leagues`}>
        <div className='grid gap-6'>
          {tiers.map(tier => (
            <div
              key={tier[0]!.tier}
              className={cn(
                'grid gap-6',
                // A tier of one league (Champions) runs the full width, with
                // its table in two columns; a tier of four sits four across.
                tier.length > 1 && 'md:grid-cols-2 xl:grid-cols-4',
              )}
            >
              {tier.map(league => (
                <LeagueCard
                  key={league.id}
                  league={league}
                  year={year}
                  wide={tier.length === 1}
                />
              ))}
            </div>
          ))}
        </div>
      </Section>

      {week && (
        <Section
          title={`Week ${week.number} Leaderboard`}
          action={
            <Link to={`/leagues/leaderboard/${year}/${week.number}`}>
              Full Week {week.number} Leaderboard
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
                  <LeagueMark name={score.league} year={year} />
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

type League = ReturnType<
  typeof useTypedLoaderData<typeof loader>
>['leagues'][number];

/** One league's table. A wide card splits it into two columns. */
function LeagueCard({
  league,
  year,
  wide,
}: {
  league: League;
  year: number;
  wide: boolean;
}) {
  return (
    <Card league={leagueFill(league.name) ?? undefined}>
      <CardHeader>
        <CardTitle>
          <Link
            to={`/leagues/${year}/${league.name.toLowerCase()}`}
            variant='quiet'
            className='inline-flex'
          >
            {league.name}
            <ChevronRightIcon aria-hidden className='ml-1 size-5 self-center' />
          </Link>
        </CardTitle>
        <span className='text-sm'>Tier {league.tier}</span>
      </CardHeader>
      <ol
        className={cn(
          'px-5 py-2',
          wide && 'md:grid md:grid-flow-col md:gap-x-12',
        )}
        style={
          wide
            ? {
                gridTemplateRows: `repeat(${Math.ceil(
                  league.teams.length / 2,
                )}, auto)`,
              }
            : undefined
        }
      >
        {league.teams.map((team, index) => (
          <li
            key={team.id}
            className='grid grid-cols-[1.5rem_1fr_auto] gap-2 py-1 text-sm [&:has([data-me])]:-mx-2 [&:has([data-me])]:bg-primary/10 [&:has([data-me])]:px-2'
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
              <WinLoss wins={team.wins} losses={team.losses} ties={team.ties} />
            </span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
