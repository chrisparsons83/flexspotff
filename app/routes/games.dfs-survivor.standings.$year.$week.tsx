import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import DfsSurvivorStandingsRow from '~/components/layout/dfs-survivor/DfsSurvivorStandingsRow';
import GoBox from '~/components/ui/GoBox';
import { authenticator } from '~/services/auth.server';
import { prisma } from '~/db.server';
import type { User } from '~/models/user.server';
import { getUsersByIds } from '~/models/user.server';

type LoaderData = {
  totalPoints: {
    userId: string;
    points: number;
    entries: any[];
  }[];
  users: User[];
  userIdToRankMap: Map<string, number>;
  maxWeek: number;
  year: number;
  week: number;
};

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });

  const yearParam = params.year;
  const weekParam = params.week;
  if (!yearParam) throw new Error('No year existing');
  if (!weekParam) throw new Error('No week existing');
  const year = +yearParam;
  const week = +weekParam;

  // Get the week's entries
  const weekEntries = await prisma.dFSSurvivorUserWeek.findFirst({
    where: {
      year,
      week,
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

  if (!weekEntries) {
    throw new Error('Week not found or not scored');
  }

  // Calculate points for each user
  const userPoints = new Map<string, { points: number; entries: any[] }>();
  
  for (const entry of weekEntries.entries) {
    const current = userPoints.get(entry.userId) || { points: 0, entries: [] };
    current.points += entry.points;
    current.entries.push(entry);
    userPoints.set(entry.userId, current);
  }

  // Convert to array and sort by points
  const totalPoints = Array.from(userPoints.entries()).map(([userId, data]) => ({
    userId,
    points: data.points,
    entries: data.entries,
  })).sort((a, b) => b.points - a.points);

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

  // Get max week for navigation
  const scoredWeeks = await prisma.dFSSurvivorUserWeek.findMany({
    where: { 
      year,
      isScored: true 
    },
    orderBy: { week: 'desc' },
  });

  const maxWeek = scoredWeeks[0]?.week || 0;

  return typedjson<LoaderData>({
    totalPoints,
    users,
    userIdToRankMap,
    maxWeek,
    year,
    week,
  });
};

export default function DfsSurvivorStandingsYearWeekIndex() {
  const { totalPoints, users, userIdToRankMap, maxWeek, year, week } = useTypedLoaderData<typeof loader>();

  const userIdToUserMap: Map<string, User> = new Map();
  for (const user of users) {
    userIdToUserMap.set(user.id, user);
  }

  const weekArray = Array.from({ length: maxWeek }, (_, i) => i + 1)
    .reverse()
    .map(weekNumber => ({
      label: `Week ${weekNumber}`,
      url: `/games/dfs-survivor/standings/${year}/${weekNumber}`,
    }));

  return (
    <>
      <h2>DFS Survivor Standings for Week {week}</h2>
      <div className='float-right mb-4'>
        <GoBox options={weekArray} buttonText='Choose Week' />
      </div>
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Name</th>
            <th>Points</th>
          </tr>
        </thead>
        <tbody>
          {totalPoints.map((result) => (
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