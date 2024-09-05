import type { ActionArgs, LoaderArgs } from "@remix-run/node";
import { Form, useTransition } from "@remix-run/react";
import { useState } from "react";

import type { Bet } from "~/models/poolgame.server";
import { getPoolGamesByYearAndWeek } from "~/models/poolgame.server";
import type {
  PoolGamePick,
  PoolGamePickCreate,
} from "~/models/poolgamepicks.server";
import {
  createPoolGamePicks,
  deletePoolGamePicksForUserAndWeek,
  getPoolGamePicksByUserAndPoolWeek,
  getPoolGamePicksByUserAndYear,
} from "~/models/poolgamepicks.server";
import type { PoolWeek } from "~/models/poolweek.server";
import { getPoolWeek, getPoolWeeksByYear } from "~/models/poolweek.server";
import {
  createPoolWeekMissed,
  getPoolWeekMissedByUserAndYear,
} from "~/models/poolweekmissed.server";
import { getCurrentSeason } from "~/models/season.server";
import type { User } from "~/models/user.server";

import SpreadPoolGameComponent from "~/components/layout/spread-pool/SpreadPoolGame";
import Alert from "~/components/ui/Alert";
import Button from "~/components/ui/Button";
import { authenticator } from "~/services/auth.server";
import {
  superjson,
  useSuperActionData,
  useSuperLoaderData,
} from "~/utils/data";

type ActionData = {
  message?: string;
};

type LoaderData = {
  user?: User;
  poolWeek?: PoolWeek;
  poolGames?: Awaited<ReturnType<typeof getPoolGamesByYearAndWeek>>;
  poolGamePicks?: PoolGamePick[];
  notOpenYet?: string;
  amountWonLoss?: number | null;
  newEntryDeduction?: number;
  missedEntryDeduction?: number;
};

export const action = async ({ params, request }: ActionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });

  let currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    throw new Error("No active season currently");
  }

  const poolWeekId = params.id;
  if (!poolWeekId) throw new Error(`No pool week ID set`);

  const poolWeek = await getPoolWeek(poolWeekId);
  if (!poolWeek) throw new Error(`Missing pool week.`);
  const poolGames = await getPoolGamesByYearAndWeek(
    poolWeek.year,
    poolWeek.weekNumber
  );

  // Create map of all teams in week and set bet to 0
  const nflTeamIdToAmountBetMap: Map<string, number> = new Map();
  for (const poolGame of poolGames) {
    nflTeamIdToAmountBetMap.set(
      `${poolGame.id}-${poolGame.game.homeTeamId}`,
      0
    );
    nflTeamIdToAmountBetMap.set(
      `${poolGame.id}-${poolGame.game.awayTeamId}`,
      0
    );
  }

  // Update map with existing bets
  const existingBets = await getPoolGamePicksByUserAndPoolWeek(user, poolWeek);
  for (const existingBet of existingBets) {
    nflTeamIdToAmountBetMap.set(
      `${existingBet.poolGameId}-${existingBet.teamBetId}`,
      existingBet.amountBet
    );
  }

  // Update map with new bets that are eligible
  const newBetsForm = await request.formData();
  for (const [key, amount] of newBetsForm.entries()) {
    const [poolGameId, teamId] = key.split("-");

    const poolGame = poolGames.find((poolGame) => poolGame.id === poolGameId);
    if (!poolGame) continue;

    if (!teamId || teamId === "undefined") {
      nflTeamIdToAmountBetMap.set(
        `${poolGameId}-${poolGame.game.homeTeamId}`,
        0
      );
      nflTeamIdToAmountBetMap.set(
        `${poolGameId}-${poolGame.game.awayTeamId}`,
        0
      );
      continue;
    }

    if (poolGame.game.gameStartTime > new Date()) {
      nflTeamIdToAmountBetMap.set(key, Math.abs(+amount));

      // Get team that's the other side of this game and set to 0.
      if (poolGame.game.awayTeamId === teamId) {
        nflTeamIdToAmountBetMap.set(
          `${poolGameId}-${poolGame.game.homeTeamId}`,
          0
        );
      } else {
        nflTeamIdToAmountBetMap.set(
          `${poolGameId}-${poolGame.game.awayTeamId}`,
          0
        );
      }
    }
  }

  // Loop through map and build promises to send down for creates
  const dataToInsert: PoolGamePickCreate[] = [];
  for (const [key, amountBet] of nflTeamIdToAmountBetMap.entries()) {
    const [poolGameId, teamBetId] = key.split("-");
    dataToInsert.push({
      userId: user.id,
      amountBet,
      poolGameId,
      teamBetId,
      isScored: false,
      isLoss: 0,
      isTie: 0,
      isWin: 0,
    });
  }

  // Delete existing bets and wholesale replace them with the insert
  // I think this is actually quicker than upserting and there's no harm in recreating this data
  await deletePoolGamePicksForUserAndWeek(user, poolWeek);
  await createPoolGamePicks(dataToInsert);

  // Do a final check to see how many weeks this person has missed before this week, and insert in
  // missing week penalties.
  const existingMissingWeeksIds = (
    await getPoolWeekMissedByUserAndYear(user.id, currentSeason.year)
  ).map((poolWeekMissed) => poolWeekMissed.poolWeek?.id);
  const picks = await getPoolGamePicksByUserAndYear(user, currentSeason.year);
  const poolWeekIds = (await getPoolWeeksByYear(currentSeason.year))
    .map((poolWeek) => poolWeek.id)
    .filter((poolWeekId) => poolWeekId !== poolWeek.id);

  const weeksPicked = new Set();
  picks
    .filter((pick) => pick.amountBet > 0)
    .forEach((pick) => {
      weeksPicked.add(pick.poolGame.poolWeek?.id);
    });
  const missingWeeks = poolWeekIds.filter(
    (poolWeekId) =>
      ![...weeksPicked].includes(poolWeekId) &&
      !existingMissingWeeksIds.includes(poolWeekId)
  );
  if (missingWeeks.length > 0) {
    const missingWeekPromises: Promise<any>[] = [];
    for (const missingWeekId of missingWeeks) {
      missingWeekPromises.push(createPoolWeekMissed(user.id, missingWeekId));
    }
    await Promise.all(missingWeekPromises);
  }

  return superjson<ActionData>(
    { message: "Your picks have been saved." },
    { headers: { "x-superjson": "true" } }
  );
};

export const loader = async ({ params, request }: LoaderArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });

  let currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    throw new Error("No active season currently");
  }

  const poolWeekId = params.id;
  if (!poolWeekId) throw new Error(`No pool week ID set`);

  const poolWeek = await getPoolWeek(poolWeekId);

  if (!poolWeek) {
    return superjson<LoaderData>({
      notOpenYet: "Week has not been created yet.",
    });
  }
  if (!poolWeek.isOpen) {
    return superjson<LoaderData>({
      notOpenYet: "Lines have not been set for this week yet.",
    });
  }

  const poolGamePicks = await getPoolGamePicksByUserAndPoolWeek(user, poolWeek);

  const poolGames = await getPoolGamesByYearAndWeek(
    poolWeek.year,
    poolWeek.weekNumber
  );

  const getAmountWonLoss = await getPoolGamePicksByUserAndYear(
    user,
    poolWeek.year
  );
  const amountWonLoss = getAmountWonLoss.reduce(
    (a, b) => a + (b.resultWonLoss || 0),
    0
  );
  const newEntryDeduction =
    getAmountWonLoss.length === 0 ? -20 * (poolWeek.weekNumber - 1) : 0;

  const missedEntryDeduction = (
    await getPoolWeekMissedByUserAndYear(user.id, currentSeason.year)
  ).reduce((a, b) => a + (b.resultWonLoss || 0), 0);

  return superjson<LoaderData>(
    {
      user,
      poolWeek,
      poolGames,
      poolGamePicks,
      amountWonLoss,
      newEntryDeduction,
      missedEntryDeduction,
    },
    { headers: { "x-superjson": "true" } }
  );
};

export default function GamesSpreadPoolWeek() {
  const actionData = useSuperActionData<ActionData>();
  const {
    notOpenYet,
    poolGames,
    poolGamePicks,
    amountWonLoss,
    newEntryDeduction,
    missedEntryDeduction,
    poolWeek,
  } = useSuperLoaderData<typeof loader>();
  const transition = useTransition();

  const existingBets =
    poolGamePicks?.map((poolGame) => ({
      teamId: poolGame.teamBetId,
      amount: poolGame.amountBet,
    })) || [];

  const initialBudget =
    1000 +
    (amountWonLoss || 0) +
    (newEntryDeduction || 0) +
    (missedEntryDeduction || 0);
  const [bets, setBets] = useState<Bet[]>(existingBets);

  const handleChange = (bets: Bet[]) => {
    setBets((prevBets) => {
      const newBetTeamIds = bets.map((bet) => bet.teamId);
      const cleanedBets = prevBets.filter(
        (prevBet) => !newBetTeamIds.includes(prevBet.teamId)
      );
      return [...cleanedBets, ...bets];
    });
  };

  const betAmount = bets.reduce((a, b) => a + b.amount, 0);
  const availableToBet = initialBudget - betAmount;

  const disableSubmit =
    transition.state !== "idle" || availableToBet < 0 || poolWeek?.isWeekScored;

  return (
    <>
      <h2>Week Entry</h2>
      <Form method="POST" reloadDocument>
        {notOpenYet || (
          <>
            {actionData?.message && <Alert message={actionData.message} />}
            <div className="mb-4">
              <div>Available to bet: {availableToBet}</div>
              <div>Amount currently bet: {betAmount}</div>
            </div>
            <div className="grid md:grid-cols-2 gap-12">
              {poolGames?.map((poolGame) => {
                const existingBet = existingBets.find(
                  (existingBet) =>
                    existingBet.amount > 0 &&
                    [
                      poolGame.game.awayTeamId,
                      poolGame.game.homeTeamId,
                    ].includes(existingBet.teamId)
                );
                const existingPoolGamePick = poolGamePicks?.find(
                  (poolGamePick) =>
                    poolGamePick.teamBetId === existingBet?.teamId
                );
                return (
                  <SpreadPoolGameComponent
                    key={poolGame.id}
                    handleChange={handleChange}
                    poolGame={poolGame}
                    existingBet={existingBet}
                    existingPoolGamePick={existingPoolGamePick}
                  />
                );
              })}
            </div>
            <div className="m-4">
              {availableToBet < 0 && (
                <p className="text-red-500">
                  You cannot bet more than your available budget, which is
                  currently {availableToBet}.
                </p>
              )}
              <input
                type="hidden"
                name="isNewEntry"
                value={Number(newEntryDeduction) !== 0 ? "true" : "false"}
              />
              <Button type="submit" disabled={disableSubmit}>
                Update Picks
              </Button>
            </div>
          </>
        )}
      </Form>
    </>
  );
}
