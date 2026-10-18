import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import StandingsSection from '~/components/layout/games/StandingsSection';
import LeaderboardTable from '~/components/layout/leaderboard/LeaderboardTable';
import {
  LOCKS_HEADINGS,
  locksStandingsEntry,
} from '~/components/layout/locks-challenge/LocksChallengeStandingsRow';
import { getLocksGamesByYearAndWeek } from '~/models/locksgame.server';
import {
  getLocksGamePicksWonLossWeek,
  getLocksGamesPicksByLocksWeek,
} from '~/models/locksgamepicks.server';
import {
  getLocksWeekByYearAndWeek,
  getLocksWeeksByYear,
} from '~/models/locksweek.server';
import { locksWeekPoints } from '~/models/profile/sideGameScoring';
import { sideGameYears } from '~/models/profile/sideGameSeasons.server';
import { getUsersByIds } from '~/models/user.server';
import { getLocksWeekCutoff, isLocksWeekLocked } from '~/utils/locks';
import { getCurrentTime } from '~/utils/time';

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const year = Number(params.year);
  const week = Number(params.week);

  // Get this week
  const currentWeek = await getLocksWeekByYearAndWeek(year, week);
  if (!currentWeek) throw new Response('No such week', { status: 404 });

  const now = getCurrentTime();

  // Get current picks for the week. A pick is public once its game has kicked
  // off, or once the whole week has locked at 1PM ET on its Sunday. The cutoff
  // comes from the week's full game list rather than the picks, because scoring
  // deletes the inactive pick rows and would leave a partial slate behind.
  const weekLocked = isLocksWeekLocked(
    getLocksWeekCutoff(
      (await getLocksGamesByYearAndWeek(year, week)).map(({ game }) => game),
    ),
    now,
  );
  const weeklyPicks = (await getLocksGamesPicksByLocksWeek(currentWeek)).filter(
    locksGamePick =>
      (locksGamePick.locksGame.game.gameStartTime < now || weekLocked) &&
      locksGamePick.isActive !== 0,
  );

  // Get users that have made bets = we can't do this in the query because prisma doesn't allow
  // including on an aggregation. I guess we could write a raw query but I want to avoid that.
  const totalPointsRaw = await getLocksGamePicksWonLossWeek(currentWeek);

  // A single loss voids the whole week - locksWeekPoints owns that rule,
  // shared with the overall standings and the profile title badges.
  const userIdToPointsMap: Map<string, number> = new Map(
    totalPointsRaw.map(amount => [amount.userId, locksWeekPoints(amount._sum)]),
  );
  const wonLossByUserId = new Map(
    totalPointsRaw.map(point => [point.userId, point._sum]),
  );

  // Create userIdToRankMap
  let userIdToRankMap: Map<string, number> = new Map();
  const userPointsArray = Array.from(userIdToPointsMap.entries());

  // Sort by points descending, then fewest losses, then most wins, so that
  // e.g. 5-1 comes before 3-1, and 3-1 comes before 7-2.
  userPointsArray.sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    const aLosses = wonLossByUserId.get(a[0])?.isLoss || 0;
    const bLosses = wonLossByUserId.get(b[0])?.isLoss || 0;
    if (aLosses !== bLosses) return aLosses - bLosses;
    const aWins = wonLossByUserId.get(a[0])?.isWin || 0;
    const bWins = wonLossByUserId.get(b[0])?.isWin || 0;
    return bWins - aWins;
  });
  // Assign ranks
  let currentRank = 1;
  let currentRankPoints = -1;
  userPointsArray.forEach(([userId, points], index) => {
    // If points change, update the rank
    if (points !== currentRankPoints) {
      currentRank = index + 1;
      currentRankPoints = points;
    }
    userIdToRankMap.set(userId, currentRank);
  });

  // Get an array of user IDs, preserving the points/losses/wins sort order above
  const sortedUserIds = userPointsArray.map(([userId]) => userId);

  // Create a map of totalPoints by userId for quick lookup
  const totalPointsMap = new Map<string, any>(
    totalPointsRaw.map(point => [point.userId, point]),
  );

  const totalPoints = sortedUserIds.map(userId => totalPointsMap.get(userId));

  const userIds = [
    ...new Set(totalPointsRaw.map(locksGameSum => locksGameSum.userId)),
  ];
  const users = await getUsersByIds(userIds);

  return typedjson({
    totalPoints,
    users,
    userIdToRankMap,
    weeklyPicks,
    userIdToPointsMap,
    weeks: (await getLocksWeeksByYear(year)).map(
      locksWeek => locksWeek.weekNumber,
    ),
    years: await sideGameYears('locks'),
    year,
    week,
  });
};

export default function LocksWeekStandings() {
  const {
    totalPoints,
    users,
    userIdToRankMap,
    weeklyPicks,
    userIdToPointsMap,
    year,
    week,
    weeks,
    years,
  } = useTypedLoaderData<typeof loader>();

  const entries = totalPoints.flatMap(result => {
    const user = users.find(candidate => candidate.id === result.userId);
    return user
      ? [
          locksStandingsEntry({
            rank: userIdToRankMap.get(result.userId),
            user,
            points: userIdToPointsMap.get(result.userId),
            locksChallengeWonLoss: result,
            picksLocked: weeklyPicks?.filter(
              pick => pick.userId === result.userId,
            ),
          }),
        ]
      : [];
  });

  return (
    <StandingsSection
      base='/games/locks-challenge/standings'
      year={year}
      week={week}
      years={years}
      weeks={weeks}
    >
      <LeaderboardTable
        entries={entries}
        nameHeading='Member'
        valueHeadings={LOCKS_HEADINGS}
        emptyMessage={`No picks scored yet for week ${week}.`}
      />
    </StandingsSection>
  );
}
