import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import type { LeaderboardEntry } from '~/components/layout/leaderboard/LeaderboardTable';
import LeaderboardTable from '~/components/layout/leaderboard/LeaderboardTable';
import StarterGrid from '~/components/layout/leaderboard/StarterGrid';
import ProfileLink from '~/components/layout/profile/ProfileLink';
import GoBox from '~/components/ui/GoBox';
import {
  getNewestWeekTeamGameByYear,
  getTeamGamesByYearAndWeek,
} from '~/models/teamgame.server';
import { RANK_COLORS, isLeagueName } from '~/utils/constants';
import { assignCompetitionRanks } from '~/utils/rank';

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const year = Number(params.year);
  const week = Number(params.week);

  const leaderboard = await getTeamGamesByYearAndWeek(year, week);

  // Bounded by the year being viewed, not the current season - otherwise the
  // week picker on a past year stops at however far the current season has got.
  const maxWeek = (await getNewestWeekTeamGameByYear(year))._max.week || 1;

  return typedjson({ leaderboard, week, maxWeek, year });
};

export default function LeaderboardYearWeek() {
  const { leaderboard, week, maxWeek, year } =
    useTypedLoaderData<typeof loader>();

  const weekArray = Array.from({ length: maxWeek }, (_, i) => i + 1)
    .reverse()
    .map(weekNumber => ({
      label: `Week ${weekNumber}`,
      url: `/leagues/leaderboard/${year}/${weekNumber}`,
    }));

  const entries: LeaderboardEntry[] = assignCompetitionRanks(
    leaderboard,
    position => position.pointsScored,
  ).map(position => {
    const leagueName = position.team.league.name.toLocaleLowerCase();

    return {
      id: position.id,
      rank: position.rank,
      name: position.team.user ? (
        <ProfileLink userId={position.team.user.id}>
          {position.team.user.discordName}
        </ProfileLink>
      ) : (
        'Missing user'
      ),
      badgeClassName: isLeagueName(leagueName)
        ? RANK_COLORS[leagueName]
        : undefined,
      values: [position.pointsScored?.toFixed(2)],
      details: (
        <StarterGrid
          starters={position.starters}
          startingPlayers={position.startingPlayers}
          startingPlayerPoints={position.startingPlayerPoints}
        />
      ),
    };
  });

  return (
    <>
      <h2>Week {week} Leaderboard</h2>

      <div className='float-right mb-4'>
        <GoBox options={weekArray} buttonText='Choose Week' />
      </div>

      <LeaderboardTable
        entries={entries}
        valueHeadings={['Points For']}
        emptyMessage={`No scores recorded yet for week ${week}.`}
      />
    </>
  );
}
