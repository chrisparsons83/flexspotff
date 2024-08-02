import type { ActionArgs, LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, Link, useActionData, useTransition } from "@remix-run/react";

import { getLocksGamesByYearAndWeek } from "~/models/locksgame.server";
import {
  getLocksGamePicksWonLoss,
  getLocksGamesPicksByLocksWeek,
  updateLocksGamePicksWithResults,
} from "~/models/locksgamepicks.server";
import type { LocksWeek } from "~/models/locksweek.server";
import {
  createLocksWeek,
  getNewestLocksWeekForYear,
  getLocksWeekByYearAndWeek,
  getLocksWeeksByYear,
  updateLocksWeek,
} from "~/models/locksweek.server";
import { createLocksWeekMissed } from "~/models/locksweekmissed.server";
import type { Season } from "~/models/season.server";
import { getCurrentSeason } from "~/models/season.server";

import Alert from "~/components/ui/Alert";
import Button from "~/components/ui/Button";
import { syncNflGameWeek } from "~/libs/syncs.server";
import { authenticator, requireAdmin } from "~/services/auth.server";
import { superjson, useSuperLoaderData } from "~/utils/data";

type ActionData = {
  formError?: string;
  message?: string;
};

type LoaderData = {
  locksWeeks: LocksWeek[];
  currentSeason: Season;
};

export const action = async ({ request }: ActionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });
  requireAdmin(user);

  const formData = await request.formData();
  const action = formData.get("_action");

  switch (action) {
    case "createNewWeek": {
      let currentSeason = await getCurrentSeason();
      if (!currentSeason) {
        throw new Error("No active season currently");
      }

      // Get max week of season, then add one
      const latestWeek = await getNewestLocksWeekForYear(currentSeason.year);
      const newWeek = latestWeek ? latestWeek.weekNumber + 1 : 1;

      // Create new LocksWeek
      await createLocksWeek({
        year: currentSeason.year,
        weekNumber: newWeek,
        isOpen: false,
        isWeekScored: false,
      });

      return json<ActionData>({ message: "Week has been created" });
    }
    case "scoreWeek": {
      const weekNumberString = formData.get("weekNumber");
      const yearString = formData.get("year");

      if (
        typeof weekNumberString !== "string" ||
        typeof yearString !== "string"
      ) {
        throw new Error("Form has not been formed correctly");
      }

      const year = Number(yearString);
      const weekNumber = Number(weekNumberString);

      const locksWeek = await getLocksWeekByYearAndWeek(+year, +weekNumber);
      if (!locksWeek) throw new Error(`There's no locks week here`);

      // Update NFL scores for the week
      await syncNflGameWeek(year, [weekNumber]);

      // TODO: Put check in here to cancel the process if all games aren't completed.

      // Add people that did not put in a bet to penalties
      const locksGamePicks = await getLocksGamesPicksByLocksWeek(locksWeek);
      const userIdsThatBet = [
        ...new Set(
          locksGamePicks
            .map((locksGamePick) => locksGamePick.userId)
        ),
      ];
      const existingUserIdsThatDidNotBet = (await getLocksGamePicksWonLoss(year))
        .map((result) => result.userId)
        .filter((userId) => !userIdsThatBet.includes(userId));

      const locksGameMissedPromises: Promise<any>[] = [];
      for (const userId of existingUserIdsThatDidNotBet) {
        locksGameMissedPromises.push(createLocksWeekMissed(userId, locksWeek.id));
      }
      await Promise.all(locksGameMissedPromises);

      // Loop through each game and process
      const locksGames = await getLocksGamesByYearAndWeek(year, weekNumber);
      const locksGamePickPromises: Promise<number | [number, number]>[] = [];
      for (const locksGame of locksGames) {
        locksGamePickPromises.push(updateLocksGamePicksWithResults(locksGame));
      }
      await Promise.all(locksGamePickPromises);

      await updateLocksWeek({
        ...locksWeek,
        isWeekScored: true,
      });

      return json<ActionData>({ message: "Week has been scored" });
    }
  }

  return json<ActionData>({ message: "Nothing has happened." });
};

export const loader = async ({ request }: LoaderArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });
  requireAdmin(user);

  let currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    throw new Error("No active season currently");
  }

  const locksWeeks = await getLocksWeeksByYear(currentSeason.year);

  return superjson<LoaderData>(
    { locksWeeks, currentSeason },
    { headers: { "x-superjson": "true" } }
  );
};

export default function SpreadLocksList() {
  const { locksWeeks, currentSeason } = useSuperLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const transition = useTransition();

  return (
    <div>
      <h2>Locks Challenge Lines by Week</h2>
      {actionData?.message && <Alert message={actionData.message} />}
      <Form method="POST">
        <div>
          {actionData?.formError ? (
            <p className="form-validation-error" role="alert">
              {actionData.formError}
            </p>
          ) : null}
          <Button
            type="submit"
            name="_action"
            value="createNewWeek"
            disabled={transition.state !== "idle"}
          >
            Create Next Week
          </Button>
        </div>
      </Form>
      <table className="w-full">
        <thead>
          <tr>
            <th>Week</th>
            <th>Published?</th>
            <th>Scored?</th>
            <th>Edit</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {locksWeeks.map((locksWeek) => (
            <tr key={locksWeek.id}>
              <td>{locksWeek.weekNumber}</td>
              <td>{locksWeek.isOpen ? "Yes" : "No"}</td>
              <td>{locksWeek.isWeekScored ? "Yes" : "No"}</td>
              <td>
                <Link to={`./${currentSeason.year}/${locksWeek.weekNumber}`}>
                  Edit Week
                </Link>
              </td>
              <td>
                <Form method="POST">
                  <input
                    type="hidden"
                    name="weekNumber"
                    value={locksWeek.weekNumber}
                  />
                  <input type="hidden" name="year" value={locksWeek.year} />
                  <Button
                    type="submit"
                    name="_action"
                    value="scoreWeek"
                    disabled={transition.state !== "idle"}
                  >
                    Score Week
                  </Button>
                </Form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
