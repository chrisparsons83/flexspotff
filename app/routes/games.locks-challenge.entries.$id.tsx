import type { ActionArgs, LoaderArgs } from "@remix-run/node";
import { Form, useTransition } from "@remix-run/react";
import { useState } from "react";

import type { TeamPick } from "~/models/locksgame.server";
import { getLocksGamesByYearAndWeek } from "~/models/locksgame.server";
import type {
  LocksGamePick,
  LocksGamePickCreate,
} from "~/models/locksgamepicks.server";
import {
  createLocksGamePicks,
  deleteLocksGamePicksForUserAndWeek,
  getLocksGamePicksByUserAndLocksWeek,
  getLocksGamePicksByUserAndYear,
} from "~/models/locksgamepicks.server";
import type { LocksWeek } from "~/models/locksweek.server";
import { getLocksWeek, getLocksWeeksByYear } from "~/models/locksweek.server";
import {
  createLocksWeekMissed,
  getLocksWeekMissedByUserAndYear,
} from "~/models/locksweekmissed.server";
import { getCurrentSeason } from "~/models/season.server";
import type { User } from "~/models/user.server";

import LocksChallengeGameComponent from "~/components/layout/locks-challenge/LocksChallengeGame";
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
  locksWeek?: LocksWeek;
  locksGames?: Awaited<ReturnType<typeof getLocksGamesByYearAndWeek>>;
  locksGamePicks?: LocksGamePick[];
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

  const locksWeekId = params.id;
  if (!locksWeekId) throw new Error(`No locks week ID set`);

  const locksWeek = await getLocksWeek(locksWeekId);
  if (!locksWeek) throw new Error(`Missing locks week.`);
  const locksGames = await getLocksGamesByYearAndWeek(
    locksWeek.year,
    locksWeek.weekNumber
  );

  // Create list to hold all selected teams
  const nflTeamsPicked: string[] = [];

  // Update map with existing bets
  const existingPicks = await getLocksGamePicksByUserAndLocksWeek(user, locksWeek);
  for (const existingPick of existingPicks) {
    if (existingPick.isActive > 0) {
      nflTeamsPicked.push(`${existingPick.locksGameId}-${existingPick.teamBetId}`);
    }
  }

  console.log("Begin existingPicks");
  for (const entry of nflTeamsPicked) {
    console.log(entry);
    console.log("---------------");
  }
  console.log("End existingPicks");

  // Update map with new picks that are eligible
  const newPicksForm = await request.formData();
  for (const [key, amount] of newPicksForm.entries()) {
    const [locksGameId, teamBetId] = key.split("-");
    const locksGame = locksGames.find((locksGame) => locksGame.id === locksGameId);
    if (!locksGame) continue;

    // If no team is bet then remove the game from the list
    if (!teamBetId || teamBetId === "undefined") {
      if (nflTeamsPicked.some(item => item.includes(`${locksGameId}`))) {
        // Remove the game from the list
        nflTeamsPicked.splice(nflTeamsPicked.findIndex(item => item.includes(`${locksGameId}`)), 1);
      } 
    }

    console.log(amount);
    console.log(typeof amount);

    if (locksGame.game.gameStartTime > new Date()) {
      // If isActive flag is 0 then do not add to nflTeamsPicked
      if (!(amount === "0")) {
        //If homeTeam is bet on previously and the awayTeam is selected
        if (nflTeamsPicked.includes(`${locksGameId}-${locksGame.game.homeTeamId}`) && teamBetId === locksGame.game.awayTeamId) {
          nflTeamsPicked.splice(nflTeamsPicked.findIndex(item => item === `${locksGameId}-${locksGame.game.homeTeamId}`), 1);
          nflTeamsPicked.push(`${locksGameId}-${teamBetId}`);
        }
        //If awayTeam is bet on previously and the homeTeam is selected
        if (nflTeamsPicked.includes(`${locksGameId}-${locksGame.game.awayTeamId}`) && teamBetId === locksGame.game.homeTeamId) {
          nflTeamsPicked.splice(nflTeamsPicked.findIndex(item => item === `${locksGameId}-${locksGame.game.awayTeamId}`), 1);
          nflTeamsPicked.push(`${locksGameId}-${teamBetId}`);
        }
        else {
          if (!nflTeamsPicked.includes(`${locksGameId}-${teamBetId}`)) {
            nflTeamsPicked.push(`${locksGameId}-${teamBetId}`);
          }
        }
      }
    }
  }

  console.log("Begin nflTeamsPicked");
  for (const entry of nflTeamsPicked) {
    console.log(entry);
    console.log("---------------");
  }
  console.log("End nflTeamsPicked");

  // Loop through map and build promises to send down for creates
  const dataToInsert: LocksGamePickCreate[] = [];
  for (const [key, picked] of nflTeamsPicked.entries()) {
    const [locksGameId, teamBetId] = picked.split("-");
    const locksGame = locksGames.find((locksGame) => locksGame.id === locksGameId);
    let otherTeamId = teamBetId === locksGame?.game.homeTeamId ? locksGame?.game.awayTeamId : locksGame?.game.homeTeamId;
      dataToInsert.push({
        userId: user.id,
        isScored: false,
        isLoss: 0,
        isTie: 0,
        isWin: 0,
        teamBetId: teamBetId,
        locksGameId: locksGameId,
        isActive: 1,
      });

      dataToInsert.push({
        userId: user.id,
        isScored: false,
        isLoss: 0,
        isTie: 0,
        isWin: 0,
        teamBetId: otherTeamId || "",
        locksGameId: locksGameId,
        isActive: 0,
      });
  }

  for (const entry of dataToInsert) {
    console.log(entry.teamBetId);
    console.log(entry.isActive);
    console.log("---------------");
  }

  // Find all the locksGame that were not created and add them to the data as inactive
  for (const locksGame of locksGames) {

    // Check if the locksGame was created
    if (!((nflTeamsPicked.filter((id) => id.includes(locksGame.id))).length > 0)) {
      // Push the data as inactive
      dataToInsert.push({
        userId: user.id,
        isScored: false,
        isLoss: 0,
        isTie: 0,
        isWin: 0,
        teamBetId: locksGame.game.homeTeamId,
        locksGameId: locksGame.id,
        isActive: 0,
      });

      dataToInsert.push({
        userId: user.id,
        isScored: false,
        isLoss: 0,
        isTie: 0,
        isWin: 0,
        teamBetId: locksGame.game.awayTeamId,
        locksGameId: locksGame.id,
        isActive: 0,
      });
    }

  }

  // Delete existing bets and wholesale replace them with the insert
  // I think this is actually quicker than upserting and there's no harm in recreating this data
  await deleteLocksGamePicksForUserAndWeek(user, locksWeek);
  await createLocksGamePicks(dataToInsert);

  // Do a final check to see how many weeks this person has missed before this week, and insert in
  // missing week penalties.
  const existingMissingWeeksIds = (
    await getLocksWeekMissedByUserAndYear(user.id, currentSeason.year)
  ).map((locksWeekMissed) => locksWeekMissed.locksWeek?.id);
  const picks = await getLocksGamePicksByUserAndYear(user, currentSeason.year);
  const locksWeekIds = (await getLocksWeeksByYear(currentSeason.year))
    .map((locksWeek) => locksWeek.id)
    .filter((locksWeekId) => locksWeekId !== locksWeek.id);

  const weeksPicked = new Set();
  picks
    .forEach((pick) => {
      weeksPicked.add(pick.locksGame.locksWeek?.id);
    });
  const missingWeeks = locksWeekIds.filter(
    (locksWeekId) =>
      ![...weeksPicked].includes(locksWeekId) &&
      !existingMissingWeeksIds.includes(locksWeekId)
  );
  if (missingWeeks.length > 0) {
    const missingWeekPromises: Promise<any>[] = [];
    for (const missingWeekId of missingWeeks) {
      missingWeekPromises.push(createLocksWeekMissed(user.id, missingWeekId));
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

  const locksWeekId = params.id;
  if (!locksWeekId) throw new Error(`No locks week ID set`);

  const locksWeek = await getLocksWeek(locksWeekId);

  if (!locksWeek) {
    return superjson<LoaderData>({
      notOpenYet: "Week has not been created yet.",
    });
  }
  if (!locksWeek.isOpen) {
    return superjson<LoaderData>({
      notOpenYet: "Week is not open yet (Blame Chris)",
    });
  }

  const locksGamePicks = await getLocksGamePicksByUserAndLocksWeek(user, locksWeek);

  const locksGames = await getLocksGamesByYearAndWeek(
    locksWeek.year,
    locksWeek.weekNumber
  );

  const  b  = await getLocksGamePicksByUserAndYear(
    user,
    locksWeek.year
  );

  return superjson<LoaderData>(
    {
      user,
      locksWeek,
      locksGames,
      locksGamePicks,
    },
    { headers: { "x-superjson": "true" } }
  );
};

export default function GamesLocksChallengeWeek() {
  const actionData = useSuperActionData<ActionData>();
  const {
    notOpenYet,
    locksGames,
    locksGamePicks,
  } = useSuperLoaderData<typeof loader>();
  const transition = useTransition();

  const existingPicks: TeamPick[] = 
    locksGamePicks?.flat().map(lockGame => ({ 
      teamId: lockGame.teamBetId,
      isActive: lockGame.isActive, 
    })) || [];
  

  const [picks, setPicks] = useState<TeamPick[]>(existingPicks);

  const handleChange = (picks: TeamPick[]) => {
    setPicks((prevPicks) => {

      const newBetTeamIds = picks.map((pick) => pick.teamId);
      const cleanedBets = prevPicks.filter(
        (prevPick) => !newBetTeamIds.includes(prevPick.teamId)
      );
      return [...cleanedBets, ...picks];

      // const picksMap = new Map<string, number>(
      //   picks.map((pick) => [pick.teamId, pick.isActive])
      // );

      // // Update prevPicks based on the values in picksMap
      // const updatedPicks = prevPicks.map(prevPick => {
      //   const isActive = picksMap.get(prevPick.teamId);
      //   return {
      //     ...prevPick,
      //     isActive: isActive !== undefined ? isActive : prevPick.isActive
      //   };
      // });

      // const picksTeamIds = new Set(picks.map(pick => pick.teamId));
      // const cleanedBets = updatedPicks.filter(prevPick => picksTeamIds.has(prevPick.teamId));

      // return [...cleanedBets, ...picks.filter(pick => !picksTeamIds.has(pick.teamId))];
    });
  };

  const disableSubmit = transition.state !== "idle";

  const currentPoints = 5;
  const gamesBetOn = 4;

  return (
    <>
      <h2>Week Entry</h2>
      <Form method="POST" reloadDocument>
        {notOpenYet || (
          <>
            {actionData?.message && <Alert message={actionData.message} />}
            <div className="mb-4">
              <div>Current Points {currentPoints}</div>
              <div>Teams Currently Picked {gamesBetOn}</div>
            </div>
            <div className="grid md:grid-cols-2 gap-12">
              {locksGames?.map((locksGame) => {
                const existingPick = existingPicks.find(
                  (existingPick) =>
                    [
                      locksGame.game.awayTeamId,
                      locksGame.game.homeTeamId,
                    ].includes(existingPick.teamId)
                );
                const existingLocksGamePick = locksGamePicks?.find(
                  (locksGamePick) =>
                    locksGamePick.teamBetId === existingPick?.teamId
                );
                return (
                  <LocksChallengeGameComponent
                    key={locksGame.id}
                    handleChange={handleChange}
                    locksGame={locksGame}
                    existingPick={existingPick}
                    existingLocksGamePick={existingLocksGamePick}
                  />
                );
              })}
            </div>
            <div className="m-4">
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
