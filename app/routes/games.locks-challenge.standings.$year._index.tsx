import type { LoaderArgs } from '@remix-run/node';
import LocksChallengeStandingsRow from '~/components/layout/locks-challenge/LocksChallengeStandingsRow';
import {
  getLocksGamePicksWonLoss,
  getLocksGamePicksWonLossWeek,
  getLocksGamesPicksByLocksWeek,
} from '~/models/locksgamepicks.server';
import {
  getLocksWeekByYearAndWeek,
  getLocksWeeksByYear,
} from '~/models/locksweek.server';
import { getCurrentSeason } from '~/models/season.server';
import type { User } from '~/models/user.server';
import { getUsersByIds } from '~/models/user.server';
import { superjson, useSuperLoaderData } from '~/utils/data';

type LoaderData = {
  totalPoints: Awaited<ReturnType<typeof getLocksGamePicksWonLoss>>;
  users: User[];
  userIdToRankMap: Map<string, number>;
  weeklyPicks?: Awaited<ReturnType<typeof getLocksGamesPicksByLocksWeek>>;
  userIdToPointsMap: Map<string, number>;
  year: number;
};

export const loader = async ({ params, request }: LoaderArgs) => {
  let currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    throw new Error('No active season currently');
  }

  const locksWeeks = await getLocksWeeksByYear(currentSeason.year);

  // Get the most active week
  const currentWeek = locksWeeks.find(locksWeek => locksWeek.isOpen === true);

  // Get current picks for the week
  const weeklyPicks =
    currentWeek &&
    (await getLocksGamesPicksByLocksWeek(currentWeek)).filter(
      locksGamePick =>
        locksGamePick.locksGame.game.gameStartTime < new Date() &&
        locksGamePick.isActive !== 0,
    );

  // Find the max week number
  const maxWeek = (await getLocksWeeksByYear(currentSeason.year))[0].weekNumber;

  let userIdToPointsMap: Map<string, number> = new Map();

  // loop through all the completed weeks for the season
  for (let i = 1; i <= maxWeek; i++) {
    // Get the locks week for that week
    const locksWeek = await getLocksWeekByYearAndWeek(currentSeason.year, i);

    if (locksWeek) {
      // Get a list of the userId and their wins for the week
      const locksWeekResults = await getLocksGamePicksWonLossWeek(locksWeek);

      // If a user got a loss for the week, set their wins to 0
      const filteredPoints = locksWeekResults.map(amount => {
        return {
          userId: amount.userId,
          _sum: {
            isWin: amount._sum.isLoss !== 0 ? 0 : amount._sum.isWin,
            isLoss: amount._sum.isLoss,
            isTie: amount._sum.isTie,
          },
        };
      });

      filteredPoints.forEach(amount => {
        const currentPoints = userIdToPointsMap.get(amount.userId) || 0;
        const weekPoints = amount._sum.isWin || 0;
        userIdToPointsMap.set(amount.userId, currentPoints + weekPoints);
      });
    }
  }

  // Get users that have made bets = we can't do this in the query because prisma doesn't allow
  // including on an aggregation. I guess we could write a raw query but I want to avoid that.
  const totalPointsRaw = await getLocksGamePicksWonLoss(currentSeason.year);

  // Add points to _sum in totalPointsRaw
  const totalPointsRawWithPoints = totalPointsRaw.map(point => ({
    ...point,
    _sum: {
      ...point._sum,
      points: userIdToPointsMap.get(point.userId) || 0,
      rank: 0,
    },
  }));

  // Add rank to _sum in totalPointsRawWithPoints array
  totalPointsRawWithPoints.forEach((point, index) => {
    point._sum.rank = index + 1;
  });

  const totalPoints = totalPointsRawWithPoints
    .filter(point => userIdToPointsMap.has(point.userId))
    .sort((a, b) => {
      // Compare _sum points
      if (a._sum.points !== b._sum.points) {
        return b._sum.points - a._sum.points; // Descending order
      } else if (a._sum.isWin !== b._sum.isWin) {
        return (b._sum.isWin || 0) - (a._sum.isWin || 0); // Descending order
      } else {
        return (a._sum.isLoss || 0) - (b._sum.isLoss || 0); // Ascending order
      }
    });
  // Assign ranks
  let currentRank = 1;
  let currentRankPoints = -1;
  let currentRankWins = -1;
  let currentRankLosses = Infinity; // Initialize with highest possible value
  totalPoints.forEach((point, index) => {
    // If points change, update the rank
    if (
      point._sum.points !== currentRankPoints ||
      point._sum.isWin !== currentRankWins ||
      (point._sum.isLoss || 0) < currentRankLosses // Check if current losses are fewer
    ) {
      currentRank = index + 1;
      currentRankPoints = point._sum.points;
      currentRankWins = point._sum.isWin || 0;
      currentRankLosses = point._sum.isLoss || 0;
    }
    point._sum.rank = currentRank;
  });

  // Create userIdToRankMap
  let userIdToRankMap: Map<string, number> = new Map();
  totalPoints.forEach(point => {
    userIdToRankMap.set(point.userId, point._sum.rank);
  });

  const userIds = [
    ...new Set(totalPointsRaw.map(locksGameSum => locksGameSum.userId)),
  ];
  const users = await getUsersByIds(userIds);

  const year = currentSeason.year;

  return superjson<LoaderData>(
    {
      totalPoints,
      users,
      userIdToRankMap,
      weeklyPicks,
      userIdToPointsMap,
      year,
    },
    { headers: { 'x-superjson': 'true' } },
  );
};

export default function LockChallengeStandingsYearIndex() {
  const {
    totalPoints,
    users,
    userIdToRankMap,
    weeklyPicks,
    userIdToPointsMap,
    year,
  } = useSuperLoaderData<typeof loader>();

  const userIdToUserMap: Map<string, User> = new Map();
  for (const user of users) {
    userIdToUserMap.set(user.id, user);
  }

  return (
    <>
      <h2>{year} Overall Standings</h2>
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Name</th>
            <th>Points</th>
            <th>W-L-T</th>
            <th>Percent</th>
          </tr>
        </thead>
        <tbody>
          {totalPoints.map((result, index) => (
            <LocksChallengeStandingsRow
              key={result.userId}
              rank={userIdToRankMap.get(result.userId)}
              user={userIdToUserMap.get(result.userId)}
              points={userIdToPointsMap.get(result.userId)}
              locksChallengeWonLoss={result}
              picksLocked={weeklyPicks?.filter(
                pick => pick.userId === result.userId,
              )}
            />
          ))}
        </tbody>
      </table>
    </>
  );
}
