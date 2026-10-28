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
  getLocksGamePicksWonLoss,
  getLocksGamePicksWonLossWeek,
  getLocksGamesPicksByLocksWeek,
} from '~/models/locksgamepicks.server';
import { getLocksWeeksByYear } from '~/models/locksweek.server';
import { locksWeekPoints } from '~/models/profile/sideGameScoring';
import { sideGameYears } from '~/models/profile/sideGameSeasons.server';
import { getCurrentSeason } from '~/models/season.server';
import { getUsersByIds } from '~/models/user.server';
import { getLocksWeekCutoff, isLocksWeekLocked } from '~/utils/locks';
import { assignCompetitionRanks } from '~/utils/rank';
import type { RouteHandle } from '~/utils/route-handle';
import { assertSeasonHasDataOrIsCurrent } from '~/utils/standings';
import { getCurrentTime } from '~/utils/time';

export const handle: RouteHandle = {
  title: ({ params }) => `${params.year} standings`,
};

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const year = Number(params.year);

  const [locksWeeks, currentSeason, years] = await Promise.all([
    getLocksWeeksByYear(year),
    getCurrentSeason(),
    sideGameYears('locks'),
  ]);
  assertSeasonHasDataOrIsCurrent(
    year,
    locksWeeks.length > 0,
    currentSeason?.year,
    'No locks challenge that year',
  );

  // Get the most active week
  const currentWeek = locksWeeks.find(locksWeek => locksWeek.isOpen === true);

  const now = getCurrentTime();

  // Get current picks for the week. A pick is public once its game has kicked
  // off, or once the whole week has locked at 1PM ET on its Sunday. The cutoff
  // comes from the week's full game list rather than the picks, because scoring
  // deletes the inactive pick rows and would leave a partial slate behind.
  const weekLocked =
    !!currentWeek &&
    isLocksWeekLocked(
      getLocksWeekCutoff(
        (
          await getLocksGamesByYearAndWeek(
            currentWeek.year,
            currentWeek.weekNumber,
          )
        ).map(({ game }) => game),
      ),
      now,
    );
  const weeklyPicks =
    currentWeek &&
    (await getLocksGamesPicksByLocksWeek(currentWeek)).filter(
      locksGamePick =>
        (locksGamePick.locksGame.game.gameStartTime < now || weekLocked) &&
        locksGamePick.isActive !== 0,
    );

  let userIdToPointsMap: Map<string, number> = new Map();

  // Each user's won/loss for every week of the season. A season with no weeks
  // yet has no standings.
  const resultsByWeek = await Promise.all(
    locksWeeks.map(locksWeek => getLocksGamePicksWonLossWeek(locksWeek)),
  );

  // A single loss voids the whole week - locksWeekPoints owns that rule,
  // shared with the profile title badges.
  for (const locksWeekResults of resultsByWeek) {
    locksWeekResults.forEach(amount => {
      const currentPoints = userIdToPointsMap.get(amount.userId) || 0;
      userIdToPointsMap.set(
        amount.userId,
        currentPoints + locksWeekPoints(amount._sum),
      );
    });
  }

  // Get users that have made bets = we can't do this in the query because prisma doesn't allow
  // including on an aggregation. I guess we could write a raw query but I want to avoid that.
  const totalPointsRaw = await getLocksGamePicksWonLoss(year);

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
  // The rules name no tiebreaker - most points wins - so equal points share a
  // rank, the same way the profile finishes and the champion badge read it.
  // Wins and losses above only order the rows within a tie.
  for (const { _sum, rank } of assignCompetitionRanks(
    totalPoints,
    point => point._sum.points,
  )) {
    _sum.rank = rank;
  }

  // Create userIdToRankMap
  let userIdToRankMap: Map<string, number> = new Map();
  totalPoints.forEach(point => {
    userIdToRankMap.set(point.userId, point._sum.rank);
  });

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
    year,
    years,
    weeks: locksWeeks.map(locksWeek => locksWeek.weekNumber),
  });
};

export default function LocksStandings() {
  const {
    totalPoints,
    users,
    userIdToRankMap,
    weeklyPicks,
    userIdToPointsMap,
    year,
    years,
    weeks,
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
      years={years}
      weeks={weeks}
    >
      <LeaderboardTable
        entries={entries}
        nameHeading='Member'
        valueHeadings={LOCKS_HEADINGS}
        emptyMessage='No weeks scored yet this season.'
      />
    </StandingsSection>
  );
}
