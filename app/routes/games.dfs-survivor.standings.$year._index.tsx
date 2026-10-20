import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import { dfsSurvivorStandingsEntry } from '~/components/layout/dfs-survivor/DfsSurvivorStandingsRow';
import StandingsSection from '~/components/layout/games/StandingsSection';
import LeaderboardTable from '~/components/layout/leaderboard/LeaderboardTable';
import { prisma } from '~/db.server';
import { sideGameYears } from '~/models/profile/sideGameSeasons.server';
import type { User } from '~/models/user.server';
import { getUsersByIds } from '~/models/user.server';
import { authenticator } from '~/services/auth.server';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = {
  title: ({ params }) => `${params.year} standings`,
};

type LoaderData = {
  totalPoints: {
    userId: string;
    points: number;
    entries: any[];
  }[];
  users: User[];
  userIdToRankMap: Map<string, number>;
  year: number;
  weeks: number[];
  years: number[];
};

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });

  const year = Number(params.year);

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
    year,
    weeks: [...new Set(scoredWeeks.map(row => row.week))].sort((a, b) => b - a),
    years: await sideGameYears('dfsSurvivor'),
  });
};

export default function DfsSurvivorStandings() {
  const { totalPoints, users, userIdToRankMap, year, weeks, years } =
    useTypedLoaderData<typeof loader>();

  const entries = totalPoints.flatMap(result => {
    const user = users.find(candidate => candidate.id === result.userId);
    return user
      ? [
          dfsSurvivorStandingsEntry({
            rank: userIdToRankMap.get(result.userId),
            user,
            points: result.points,
            entries: result.entries,
          }),
        ]
      : [];
  });

  return (
    <StandingsSection
      base='/games/dfs-survivor/standings'
      year={year}
      years={years}
      weeks={weeks}
      description='Points from every scored week.'
    >
      <LeaderboardTable
        entries={entries}
        nameHeading='Member'
        valueHeadings={['Points']}
        emptyMessage='No weeks scored yet this season.'
      />
    </StandingsSection>
  );
}
