import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import type { LeaderboardEntry } from '~/components/layout/leaderboard/LeaderboardTable';
import LeaderboardTable from '~/components/layout/leaderboard/LeaderboardTable';
import StarterGrid from '~/components/layout/leaderboard/StarterGrid';
import GoBox from '~/components/ui/GoBox';
import MemberName from '~/components/ui/MemberName';
import { Link } from '~/components/ui/link';
import { ProfileLink } from '~/components/ui/profile-link';
import { Section } from '~/components/ui/section';
import {
  getNewestWeekTeamGameByYear,
  getTeamGamesByYearAndWeek,
} from '~/models/teamgame.server';
import { assignCompetitionRanks } from '~/utils/rank';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = {
  title: ({ params }) => `Week ${params.week}`,
};

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const year = Number(params.year);
  const week = Number(params.week);
  if (!Number.isInteger(year) || !Number.isInteger(week)) {
    throw new Response('Week not found', { status: 404 });
  }

  const leaderboard = await getTeamGamesByYearAndWeek(year, week);

  // Bounded by the year being viewed, not the current season - otherwise the
  // week picker on a past year stops at however far the current season has got.
  const maxWeek = (await getNewestWeekTeamGameByYear(year))._max.week || 1;

  return typedjson({ leaderboard, week, maxWeek, year });
};

export default function LeaderboardYearWeek() {
  const { leaderboard, week, maxWeek, year } =
    useTypedLoaderData<typeof loader>();

  const weekOptions = Array.from(
    { length: maxWeek },
    (_, i) => maxWeek - i,
  ).map(weekNumber => ({
    label: `Week ${weekNumber}`,
    url: `/leagues/leaderboard/${year}/${weekNumber}`,
  }));

  const entries: LeaderboardEntry[] = assignCompetitionRanks(
    leaderboard,
    position => position.pointsScored,
  ).map(position => ({
    id: position.id,
    rank: position.rank,
    name: position.team.user ? (
      <ProfileLink userId={position.team.user.id}>
        <MemberName user={position.team.user} />
      </ProfileLink>
    ) : (
      'Unclaimed team'
    ),
    league: position.team.league.name,
    values: [position.pointsScored?.toFixed(2)],
    details: (
      <StarterGrid
        starters={position.starters}
        startingPlayers={position.startingPlayers}
        startingPlayerPoints={position.startingPlayerPoints}
      />
    ),
  }));

  return (
    <Section
      title={`Week ${week} leaderboard`}
      action={
        <div className='flex flex-wrap items-center gap-4'>
          <Link to={`/leagues/leaderboard/${year}`}>
            {year} season leaderboard
          </Link>
          <GoBox options={weekOptions} buttonText='Week' />
        </div>
      }
    >
      <LeaderboardTable
        entries={entries}
        valueHeadings={['Points for']}
        emptyMessage={`No scores recorded yet for week ${week}.`}
      />
    </Section>
  );
}
