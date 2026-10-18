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

type LoaderData = {
  totalPoints: {
    userId: string;
    points: number;
    entries: any[];
  }[];
  users: User[];
  userIdToRankMap: Map<string, number>;
  weeks: number[];
  years: number[];
  year: number;
  week: number;
};

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });

  const year = Number(params.year);
  const week = Number(params.week);

  // Get max week for navigation (still use scored weeks for navigation)
  const scoredWeeksForMaxWeek = await prisma.dFSSurvivorUserWeek.findMany({
    where: {
      year,
      isScored: true,
    },
    orderBy: { week: 'desc' },
  });

  const weeks = [...new Set(scoredWeeksForMaxWeek.map(row => row.week))];
  const years = await sideGameYears('dfsSurvivor');

  // Get all week entries for the specified week (scored or unscored)
  const weekEntries = await prisma.dFSSurvivorUserWeek.findMany({
    where: {
      year,
      week,
    },
    include: {
      entries: {
        include: {
          player: true,
        },
      },
    },
  });

  if (!weekEntries || weekEntries.length === 0) {
    return typedjson<LoaderData>({
      totalPoints: [],
      users: [],
      userIdToRankMap: new Map(),
      weeks,
      years,
      year,
      week,
    });
  }

  // Calculate points for each user from all their entries across all week records
  const userPoints = new Map<string, { points: number; entries: any[] }>();

  for (const weekRecord of weekEntries) {
    for (const entry of weekRecord.entries) {
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

  const userIdToUserMap: Map<string, User> = new Map();
  for (const user of users) {
    userIdToUserMap.set(user.id, user);
  }

  return typedjson<LoaderData>({
    totalPoints,
    users,
    userIdToRankMap,
    weeks,
    years,
    year,
    week,
  });
};

export default function DfsSurvivorWeekStandings() {
  const { totalPoints, users, userIdToRankMap, year, week, weeks, years } =
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
            showFlexAsActualPosition: false,
          }),
        ]
      : [];
  });

  return (
    <StandingsSection
      base='/games/dfs-survivor/standings'
      year={year}
      week={week}
      years={years}
      weeks={weeks}
    >
      <LeaderboardTable
        entries={entries}
        nameHeading='Member'
        valueHeadings={['Points']}
        emptyMessage={`No lineups for week ${week}.`}
      />
    </StandingsSection>
  );
}
