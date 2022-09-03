import type { ActionArgs, LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, Link, useActionData, useTransition } from "@remix-run/react";

import { getPoolGamesByYearAndWeek } from "~/models/poolgame.server";
import { updatePoolGamePicksWithResults } from "~/models/poolgamepicks.server";
import type { PoolWeek } from "~/models/poolweek.server";
import {
  createPoolWeek,
  getNewestPoolWeekForYear,
  getPoolWeeksByYear,
} from "~/models/poolweek.server";

import Alert from "~/components/ui/Alert";
import Button from "~/components/ui/Button";
import { syncNflGameWeek } from "~/libs/syncs.server";
import { authenticator, requireAdmin } from "~/services/auth.server";
import { CURRENT_YEAR } from "~/utils/constants";
import { superjson, useSuperLoaderData } from "~/utils/data";

type ActionData = {
  formError?: string;
  message?: string;
};

type LoaderData = {
  poolWeeks: PoolWeek[];
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
      // Get max week of season, then add one
      const latestWeek = await getNewestPoolWeekForYear(CURRENT_YEAR);
      const newWeek = latestWeek ? latestWeek.weekNumber + 1 : 1;

      // Create new PoolWeek
      await createPoolWeek({
        year: CURRENT_YEAR,
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

      // Update NFL scores for the week
      await syncNflGameWeek(year, [weekNumber]);

      // Loop through each game and process
      const poolGames = await getPoolGamesByYearAndWeek(year, weekNumber);
      const poolGamePickPromises: Promise<number | [number, number]>[] = [];
      for (const poolGame of poolGames) {
        poolGamePickPromises.push(updatePoolGamePicksWithResults(poolGame));
      }
      await Promise.all(poolGamePickPromises);

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

  const poolWeeks = await getPoolWeeksByYear(CURRENT_YEAR);

  return superjson<LoaderData>(
    { poolWeeks },
    { headers: { "x-superjson": "true" } }
  );
};

export default function SpreadPoolList() {
  const { poolWeeks } = useSuperLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const transition = useTransition();

  return (
    <div>
      <h2>Spread Pool Lines by Week</h2>
      {actionData?.message && <Alert message={actionData.message} />}
      <Form method="post">
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
            <th>Edit</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {poolWeeks.map((poolWeek) => (
            <tr key={poolWeek.id}>
              <td>{poolWeek.weekNumber}</td>
              <td>{poolWeek.isOpen ? "Yes" : "No"}</td>
              <td>
                <Link to={`./${CURRENT_YEAR}/${poolWeek.weekNumber}`}>
                  Edit Week
                </Link>
              </td>
              <td>
                <Form method="post">
                  <input
                    type="hidden"
                    name="weekNumber"
                    value={poolWeek.weekNumber}
                  />
                  <input type="hidden" name="year" value={poolWeek.year} />
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
