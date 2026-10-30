import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import StandingsSection from '~/components/layout/games/StandingsSection';
import LeaderboardTable from '~/components/layout/leaderboard/LeaderboardTable';
import {
  SPREAD_POOL_HEADINGS,
  spreadPoolStandingsEntry,
} from '~/components/layout/spread-pool/SpreadPoolStandingsRow';
import {
  getPoolGamePicksWonLoss,
  getPoolGamesPicksByPoolWeek,
} from '~/models/poolgamepicks.server';
import { getPoolWeeksByYear } from '~/models/poolweek.server';
import { getPoolWeekMissedTotalByUserAndYear } from '~/models/poolweekmissed.server';
import { sideGameYears } from '~/models/profile/sideGameSeasons.server';
import { getCurrentSeason } from '~/models/season.server';
import { getUsersByIds } from '~/models/user.server';
import { assertSeasonHasDataOrIsCurrent } from '~/utils/standings';

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const year = Number(params.year);
  const [poolWeeks, years, currentSeason] = await Promise.all([
    getPoolWeeksByYear(year),
    sideGameYears('spreadPool'),
    getCurrentSeason(),
  ]);
  assertSeasonHasDataOrIsCurrent(
    year,
    years.includes(year),
    currentSeason?.year,
    'No Spread Pool that year',
  );

  // Get the most active week
  const currentWeek = poolWeeks.find(poolWeek => poolWeek.isOpen === true);

  // Get current picks for the week
  const weeklyPicks =
    currentWeek &&
    (await getPoolGamesPicksByPoolWeek(currentWeek)).filter(
      poolGamePick =>
        poolGamePick.poolGame.game.gameStartTime < new Date() &&
        poolGamePick.amountBet !== 0,
    );

  const amountWonLoss = await getPoolGamePicksWonLoss(year);

  // Update amountWonLoss based on missing week totals, then re-sort.
  const missingWeekPenalties = await getPoolWeekMissedTotalByUserAndYear(year);
  if (missingWeekPenalties.length > 0) {
    for (const missingWeekPenalty of missingWeekPenalties) {
      const updateIndex = amountWonLoss.findIndex(
        amount => amount.userId === missingWeekPenalty.userId,
      );
      if (updateIndex !== -1) {
        amountWonLoss[updateIndex]._sum.resultWonLoss =
          (amountWonLoss[updateIndex]._sum.resultWonLoss || 0) +
          (missingWeekPenalty._sum.resultWonLoss || 0);
      }
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

  return typedjson({
    amountWonLoss,
    users,
    userIdToRankMap,
    weeklyPicks,
    year,
    years,
    weeks: poolWeeks.map(poolWeek => poolWeek.weekNumber),
  });
};

export default function SpreadPoolStandings() {
  const {
    amountWonLoss,
    users,
    userIdToRankMap,
    weeklyPicks,
    year,
    years,
    weeks,
  } = useTypedLoaderData<typeof loader>();

  const entries = amountWonLoss.flatMap(result => {
    const user = users.find(candidate => candidate.id === result.userId);
    return user
      ? [
          spreadPoolStandingsEntry({
            rank: userIdToRankMap.get(result.userId),
            user,
            poolGameWonLoss: result,
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
      years={years}
      weeks={weeks}
    >
      <LeaderboardTable
        entries={entries}
        nameHeading='Member'
        valueHeadings={SPREAD_POOL_HEADINGS}
        emptyMessage='No bets scored yet this season.'
      />
    </StandingsSection>
  );
}
