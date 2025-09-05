import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import SpreadPoolStandingsRow from '~/components/layout/spread-pool/SpreadPoolStandingsRow';
import {
  getPoolGamePicksWonLoss,
  getPoolGamesPicksByPoolWeek,
} from '~/models/poolgamepicks.server';
import { getPoolWeeksByYear } from '~/models/poolweek.server';
import { getPoolWeekMissedTotalByUserAndYear } from '~/models/poolweekmissed.server';
import type { User } from '~/models/user.server';
import { getUsersByIds } from '~/models/user.server';

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const yearParam = params.year;
  if (!yearParam) throw new Error('No year existing');
  const year = +yearParam;

  const poolWeeks = await getPoolWeeksByYear(year);

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
  const missingWeekPenalties = await getPoolWeekMissedTotalByUserAndYear(
    year,
  );
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

  return typedjson({ amountWonLoss, users, userIdToRankMap, weeklyPicks });
};

export default function QBStreamingStandingsYearIndex() {
  const { amountWonLoss, users, userIdToRankMap, weeklyPicks } =
    useTypedLoaderData<typeof loader>();

  const userIdToUserMap: Map<string, User> = new Map();
  for (const user of users) {
    userIdToUserMap.set(user.id, user);
  }

  return (
    <>
      <h2>Overall Standings</h2>
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
