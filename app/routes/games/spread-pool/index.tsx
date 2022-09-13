import type { LoaderArgs } from "@remix-run/node";
import { Link } from "@remix-run/react";

import {
  getPoolGamePicksWonLoss,
  getPoolGamesPicksByPoolWeek,
} from "~/models/poolgamepicks.server";
import type { PoolWeek } from "~/models/poolweek.server";
import { getPoolWeeksByYear } from "~/models/poolweek.server";
import { getPoolWeekMissedTotalByUserAndYear } from "~/models/poolweekmissed.server";
import type { User } from "~/models/user.server";
import { getUsersByIds } from "~/models/user.server";

import SpreadPoolStandingsRow from "~/components/layout/spread-pool/SpreadPoolStandingsRow";
import { CURRENT_YEAR } from "~/utils/constants";
import { superjson, useSuperLoaderData } from "~/utils/data";

type LoaderData = {
  poolWeeks: PoolWeek[];
  amountWonLoss: Awaited<ReturnType<typeof getPoolGamePicksWonLoss>>;
  users: User[];
  weeklyPicks?: Awaited<ReturnType<typeof getPoolGamesPicksByPoolWeek>>;
  userIdToRankMap: Map<string, number>;
};

export const loader = async ({ params, request }: LoaderArgs) => {
  const poolWeeks = await getPoolWeeksByYear(CURRENT_YEAR);

  // Get the most active week
  const currentWeek = poolWeeks.find((poolWeek) => poolWeek.isOpen === true);

  // Get current picks for the week
  const weeklyPicks =
    currentWeek &&
    (await getPoolGamesPicksByPoolWeek(currentWeek)).filter(
      (poolGamePick) =>
        poolGamePick.poolGame.game.gameStartTime < new Date() &&
        poolGamePick.amountBet !== 0
    );

  const amountWonLoss = await getPoolGamePicksWonLoss();

  // Update amountWonLoss based on missing week totals, then re-sort.
  const missingWeekPenalties = await getPoolWeekMissedTotalByUserAndYear(
    CURRENT_YEAR
  );
  if (missingWeekPenalties.length > 0) {
    for (const missingWeekPenalty of missingWeekPenalties) {
      const updateIndex = amountWonLoss.findIndex(
        (amount) => amount.userId === missingWeekPenalty.userId
      );
      if (updateIndex !== 1) {
        amountWonLoss[updateIndex]._sum.resultWonLoss =
          (amountWonLoss[updateIndex]._sum.resultWonLoss || 0) +
          (missingWeekPenalty._sum.resultWonLoss || 0);
      }
    }
    amountWonLoss.sort((a, b) => b._sum.resultWonLoss! - a._sum.resultWonLoss!);
  }

  const sortingOrderForRanks = amountWonLoss.map(
    (amount) => amount._sum.resultWonLoss
  );
  const userIdToRankMap: Map<string, number> = new Map();
  for (const result of amountWonLoss) {
    userIdToRankMap.set(
      result.userId,
      sortingOrderForRanks.findIndex(
        (total) => result._sum.resultWonLoss === total
      ) + 1
    );
  }

  // Get users that have made bets = we can't do this in the query because prisma doesn't allow
  // including on an aggregation. I guess we could write a raw query but I want to avoid that.
  const userIds = [
    ...new Set(amountWonLoss.map((poolGameSum) => poolGameSum.userId)),
  ];
  const users = await getUsersByIds(userIds);

  return superjson<LoaderData>(
    { poolWeeks, amountWonLoss, users, weeklyPicks, userIdToRankMap },
    { headers: { "x-superjson": "true" } }
  );
};

export default function GamesSpreadPoolIndex() {
  const { poolWeeks, amountWonLoss, users, weeklyPicks, userIdToRankMap } =
    useSuperLoaderData<typeof loader>();

  const userIdToUserMap: Map<string, User> = new Map();
  for (const user of users) {
    userIdToUserMap.set(user.id, user);
  }

  return (
    <>
      <h2>Spread Pool</h2>
      <h3>Rules</h3>
      <p>
        Start the season with 1000 points. Each week, you must make at least one
        bet, but may make as many as you want that fit within your budget. Max
        bet on any one game is 50 points. Payouts are paid out at even points
        for being correct. Bets lock as games start. You can't use winnings from
        the current week to bet on teams in the same week. Missing a week will
        result in forfeiting 20 points. Highest total at the end of NFL regular
        season wins.
      </p>
      <h3>My Entries</h3>
      {poolWeeks.map((poolWeek) => (
        <li key={poolWeek.id}>
          <Link to={`./${poolWeek.year}/${poolWeek.weekNumber}`}>
            Week {poolWeek.weekNumber}
            {!poolWeek.isOpen && ` - Not Open`}
          </Link>
        </li>
      ))}
      <section>
        <h3>Overall Standings</h3>
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Name</th>
              <th>Bank</th>
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
                  (pick) => pick.userId === result.userId
                )}
              />
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
