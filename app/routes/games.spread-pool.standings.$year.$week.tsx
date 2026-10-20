import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import StandingsSection from '~/components/layout/games/StandingsSection';
import LeaderboardTable from '~/components/layout/leaderboard/LeaderboardTable';
import { spreadPoolStandingsEntry } from '~/components/layout/spread-pool/SpreadPoolStandingsRow';
import {
  getPoolGamePicksWonLossWeek,
  getPoolGamesPicksByPoolWeek,
} from '~/models/poolgamepicks.server';
import {
  getPoolWeekByYearAndWeek,
  getPoolWeeksByYear,
} from '~/models/poolweek.server';
import { getPoolWeekMissedTotalByUserAndYearAndWeek } from '~/models/poolweekmissed.server';
import { sideGameYears } from '~/models/profile/sideGameSeasons.server';
import { getUsersByIds } from '~/models/user.server';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = {
  title: ({ params }) => `Week ${params.week}, ${params.year} standings`,
};

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const year = Number(params.year);
  const week = Number(params.week);

  // Get this week
  const currentWeek = await getPoolWeekByYearAndWeek(year, week);
  if (!currentWeek) throw new Response('No such week', { status: 404 });

  // Get current picks for the week
  const weeklyPicks =
    currentWeek &&
    (await getPoolGamesPicksByPoolWeek(currentWeek)).filter(
      poolGamePick =>
        poolGamePick.poolGame.game.gameStartTime < new Date() &&
        poolGamePick.amountBet !== 0,
    );

  const amountWonLoss = await getPoolGamePicksWonLossWeek(currentWeek);

  // Update amountWonLoss based on missing week totals, then re-sort.
  const missingWeekPenalties = await getPoolWeekMissedTotalByUserAndYearAndWeek(
    year,
    week,
  );
  if (missingWeekPenalties.length > 0) {
    for (const missingWeekPenalty of missingWeekPenalties) {
      amountWonLoss.push(missingWeekPenalty);
    }
    amountWonLoss.sort((a, b) => b._sum.resultWonLoss! - a._sum.resultWonLoss!);
  }

  const sortingOrderForRanks = amountWonLoss.map(
    amount => amount._sum.resultWonLoss,
  );
  const userIdToRankMap: Map<string, number> = new Map();
  for (const result of amountWonLoss) {
    userIdToRankMap.set(
      result.userId,
      sortingOrderForRanks.findIndex(
        total => result._sum.resultWonLoss === total,
      ) + 1,
    );
  }

  // Get users that have made bets = we can't do this in the query because prisma doesn't allow
  // including on an aggregation. I guess we could write a raw query but I want to avoid that.
  const userIds = [
    ...new Set(amountWonLoss.map(poolGameSum => poolGameSum.userId)),
  ];
  const users = await getUsersByIds(userIds);

  const [poolWeeks, years] = await Promise.all([
    getPoolWeeksByYear(year),
    sideGameYears('spreadPool'),
  ]);

  return typedjson({
    amountWonLoss,
    users,
    userIdToRankMap,
    weeklyPicks,
    weeks: poolWeeks.map(poolWeek => poolWeek.weekNumber),
    years,
    year,
    week,
  });
};

export default function SpreadPoolWeekStandings() {
  const {
    amountWonLoss,
    users,
    userIdToRankMap,
    weeklyPicks,
    year,
    week,
    weeks,
    years,
  } = useTypedLoaderData<typeof loader>();

  const entries = amountWonLoss.flatMap(result => {
    const user = users.find(candidate => candidate.id === result.userId);
    return user
      ? [
          spreadPoolStandingsEntry({
            rank: userIdToRankMap.get(result.userId),
            user,
            poolGameWonLoss: result,
            initialBudget: 0,
            picksLocked: weeklyPicks?.filter(
              pick => pick.userId === result.userId,
            ),
          }),
        ]
      : [];
  });

  return (
    <StandingsSection
      base='/games/spread-pool/standings'
      year={year}
      week={week}
      years={years}
      weeks={weeks}
      description='What each member won or lost on the week.'
    >
      <LeaderboardTable
        entries={entries}
        nameHeading='Member'
        valueHeadings={['Net', 'W-L-T', 'Return']}
        emptyMessage={`No bets scored yet for week ${week}.`}
      />
    </StandingsSection>
  );
}
