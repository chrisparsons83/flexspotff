import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import DfsSurvivorStandingsRow from '~/components/layout/dfs-survivor/DfsSurvivorStandingsRow';
import { prisma } from '~/db.server';
import type { User } from '~/models/user.server';
import { getUsersByIds } from '~/models/user.server';
import { authenticator } from '~/services/auth.server';

type LoaderData = {
  totalPoints: {
    userId: string;
    points: number;
    entries: any[];
  }[];
  users: User[];
  userIdToRankMap: Map<string, number>;
};

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });

  const yearParam = params.year;
  if (!yearParam) throw new Error('No year existing');
  const year = +yearParam;

  // Get all scored weeks for the season
  const scoredWeeks = await prisma.dFSSurvivorUserWeek.findMany({
    where: {
      year,
      isScored: true,
    },
    include: {
      entries: {
        include: {
          player: true,
        },
      },
    },
  });

  // Calculate total points for each user
  const userPoints = new Map<string, { points: number; entries: any[] }>();

  for (const week of scoredWeeks) {
    for (const entry of week.entries) {
      const current = userPoints.get(entry.userId) || {
        points: 0,
        entries: [],
      };
      current.points += entry.points;
      current.entries.push(entry);
      userPoints.set(entry.userId, current);
    }
  }

  // Convert to array and sort by points
  const totalPoints = Array.from(userPoints.entries())
    .map(([userId, data]) => ({
      userId,
      points: data.points,
      entries: data.entries,
    }))
    .sort((a, b) => b.points - a.points);

  // Create rank map
  const userIdToRankMap = new Map<string, number>();
  let currentRank = 1;
  let currentPoints = -1;

  totalPoints.forEach((result, index) => {
    if (result.points !== currentPoints) {
      currentRank = index + 1;
      currentPoints = result.points;
    }
    userIdToRankMap.set(result.userId, currentRank);
  });

  // Get user details
  const userIds = totalPoints.map(result => result.userId);
  const users = await getUsersByIds(userIds);

  return typedjson<LoaderData>({
    totalPoints,
    users,
    userIdToRankMap,
  });
};

export default function DfsSurvivorStandingsYearIndex() {
  const { totalPoints, users, userIdToRankMap } =
    useTypedLoaderData<typeof loader>();

  const userIdToUserMap: Map<string, User> = new Map();
  for (const user of users) {
    userIdToUserMap.set(user.id, user);
  }

  return (
    <>
      <h2>DFS Survivor Overall Standings</h2>
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Name</th>
            <th>Points</th>
          </tr>
        </thead>
        <tbody>
          {totalPoints.map(result => (
            <DfsSurvivorStandingsRow
              key={result.userId}
              rank={userIdToRankMap.get(result.userId)}
              user={userIdToUserMap.get(result.userId)}
              points={result.points}
              entries={result.entries}
            />
          ))}
        </tbody>
      </table>
    </>
  );
}
