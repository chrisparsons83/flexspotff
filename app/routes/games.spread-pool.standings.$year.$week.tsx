import type { LoaderArgs } from '@remix-run/node';

import type { getPoolGamePicksWonLoss } from '~/models/poolgamepicks.server';
import {
  getPoolGamePicksWonLossWeek,
  getPoolGamesPicksByPoolWeek,
} from '~/models/poolgamepicks.server';
import {
  getPoolWeekByYearAndWeek,
  getPoolWeeksByYear,
} from '~/models/poolweek.server';
import { getPoolWeekMissedTotalByUserAndYearAndWeek } from '~/models/poolweekmissed.server';
import type { User } from '~/models/user.server';
import { getUsersByIds } from '~/models/user.server';

import SpreadPoolStandingsRow from '~/components/layout/spread-pool/SpreadPoolStandingsRow';
import GoBox from '~/components/ui/GoBox';
import { superjson, useSuperLoaderData } from '~/utils/data';

type LoaderData = {
  amountWonLoss: Awaited<ReturnType<typeof getPoolGamePicksWonLoss>>;
  users: User[];
  userIdToRankMap: Map<string, number>;
  weeklyPicks?: Awaited<ReturnType<typeof getPoolGamesPicksByPoolWeek>>;
  maxWeek: number;
  year: number;
  week: number;
};

export const loader = async ({ params, request }: LoaderArgs) => {
  const yearParam = params.year;
  const weekParam = params.week;
  if (!yearParam) throw new Error('No year existing');
  if (!weekParam) throw new Error('No week existing');
  const year = +yearParam;
  const week = +weekParam;

  // Get this week
  const currentWeek = await getPoolWeekByYearAndWeek(year, week);
  if (!currentWeek) throw new Error('Week does not exist');

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

  // Get maximum week
  const maxWeek = (await getPoolWeeksByYear(year))[0].weekNumber;

  return superjson<LoaderData>(
    { amountWonLoss, users, userIdToRankMap, weeklyPicks, maxWeek, year, week },
    { headers: { 'x-superjson': 'true' } },
  );
};

export default function SpreadPoolStandingsYearWeekIndex() {
  const {
    amountWonLoss,
    users,
    userIdToRankMap,
    weeklyPicks,
    year,
    week,
    maxWeek,
  } = useSuperLoaderData<typeof loader>();

  const userIdToUserMap: Map<string, User> = new Map();
  for (const user of users) {
    userIdToUserMap.set(user.id, user);
  }

  const weekArray = Array.from({ length: maxWeek }, (_, i) => i + 1)
    .reverse()
    .map(weekNumber => ({
      label: `Week ${weekNumber}`,
      url: `/games/spread-pool/standings/${year}/${weekNumber}`,
    }));

  return (
    <>
      <h2>
        {year} Standings for Week {week}
      </h2>
      <div className='float-right mb-4'>
        <GoBox options={weekArray} buttonText='Choose Week' />
      </div>
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Name</th>
            <th>Bank</th>
            <th>W-L-T</th>
            <th>ROE</th>
          </tr>
        </thead>
        <tbody>
          {amountWonLoss.map((result, index) => (
            <SpreadPoolStandingsRow
              initialBudget={0}
              key={result.userId}
              rank={userIdToRankMap.get(result.userId)}
              user={userIdToUserMap.get(result.userId)}
              poolGameWonLoss={result}
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
