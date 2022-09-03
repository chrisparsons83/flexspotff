import type { LoaderArgs } from "@remix-run/node";
import { Link } from "@remix-run/react";

import {
  getPoolGamePicksWonLoss,
  getPoolGamesPicksByPoolWeek,
} from "~/models/poolgamepicks.server";
import type { PoolWeek } from "~/models/poolweek.server";
import { getPoolWeeksByYear } from "~/models/poolweek.server";
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

  // Get users that have made bets = we can't do this in the query because prisma doesn't allow
  // including on an aggregation. I guess we could write a raw query but I want to avoid that.
  const userIds = [
    ...new Set(amountWonLoss.map((poolGameSum) => poolGameSum.userId)),
  ];
  const users = await getUsersByIds(userIds);

  return superjson<LoaderData>(
    { poolWeeks, amountWonLoss, users, weeklyPicks },
    { headers: { "x-superjson": "true" } }
  );
};

export default function GamesSpreadPoolIndex() {
  const { poolWeeks, amountWonLoss, users, weeklyPicks } =
    useSuperLoaderData<typeof loader>();

  const userIdToUserMap: Map<string, User> = new Map();
  for (const user of users) {
    userIdToUserMap.set(user.id, user);
  }

  return (
    <>
      <h2>Spread Pool</h2>
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
                rank={index + 1}
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
