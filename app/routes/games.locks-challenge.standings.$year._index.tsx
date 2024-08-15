import type { LoaderArgs } from "@remix-run/node";

import {
  getLocksGamePicksWonLoss,
  getLocksGamesPicksByLocksWeek,
  getLocksGamePicksWonLossWeek
} from "~/models/locksgamepicks.server";
import { getLocksWeeksByYear, getLocksWeekByYearAndWeek } from "~/models/locksweek.server";
import { getCurrentSeason } from "~/models/season.server";
import type { User } from "~/models/user.server";
import { getUsersByIds } from "~/models/user.server";

import LocksChallengeStandingsRow from "~/components/layout/locks-challenge/LocksChallengeStandingsRow";
import { superjson, useSuperLoaderData } from "~/utils/data";

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
    throw new Error("No active season currently");
  }

  const locksWeeks = await getLocksWeeksByYear(currentSeason.year);

  // Get the most active week
  const currentWeek = locksWeeks.find((locksWeek) => locksWeek.isOpen === true);

  // Get current picks for the week
  const weeklyPicks =
    currentWeek &&
    (await getLocksGamesPicksByLocksWeek(currentWeek)).filter(
      (locksGamePick) =>
        //locksGamePick.locksGame.game.gameStartTime < new Date() &&
        locksGamePick.isActive !== 0
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
      const filteredPoints = locksWeekResults.map( (amount) => {
        return {
          userId: amount.userId,
          _sum: {
            isWin: amount._sum.isLoss !== 0 ? 0 : amount._sum.isWin,
            isLoss: amount._sum.isLoss,
            isTie: amount._sum.isTie
          }
        }
      }
      );

      filteredPoints.forEach((amount) => {
        const currentPoints = userIdToPointsMap.get(amount.userId) || 0;
        const weekPoints = amount._sum.isWin || 0;
        userIdToPointsMap.set(amount.userId, currentPoints + weekPoints);
      });
    }
  }

  // Create userIdToRankMap
  let userIdToRankMap: Map<string, number> = new Map();
  const userPointsArray = Array.from(userIdToPointsMap.entries());

  // Sort the array by points in descending order
  userPointsArray.sort((a, b) => b[1] - a[1]);

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

  // Get users that have made bets = we can't do this in the query because prisma doesn't allow
  // including on an aggregation. I guess we could write a raw query but I want to avoid that.
  const totalPointsRaw = await getLocksGamePicksWonLoss(currentSeason.year);

  // Get an array of user IDs sorted by rank
  const sortedUserIds = Array.from(userIdToRankMap.entries())
    .sort((a, b) => a[1] - b[1])  // Sort by rank
    .map(([userId]) => userId);    // Extract user IDs

  // Create a map of totalPoints by userId for quick lookup
  const totalPointsMap = new Map<string, any>(
    totalPointsRaw.map(point => [point.userId, point])
  );

  const totalPoints = sortedUserIds.map(userId => totalPointsMap.get(userId));

  const userIds = [
    ...new Set(totalPointsRaw.map((locksGameSum) => locksGameSum.userId)),
  ];
  const users = await getUsersByIds(userIds);

  const year = currentSeason.year;

  return superjson<LoaderData>(
    { totalPoints, users, userIdToRankMap, weeklyPicks, userIdToPointsMap, year },
    { headers: { "x-superjson": "true" } }
  );
};

export default function LockChallengeStandingsYearIndex() {
  const { totalPoints, users, userIdToRankMap, weeklyPicks, userIdToPointsMap, year } =
    useSuperLoaderData<typeof loader>();

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
                (pick) => pick.userId === result.userId
              )}
            />
          ))}
        </tbody>
      </table>
    </>
  );
}
