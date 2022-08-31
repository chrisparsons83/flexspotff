import type { ActionArgs, LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, Link, useActionData, useTransition } from "@remix-run/react";

import type { PoolWeek } from "~/models/poolweek.server";
import {
  createPoolWeek,
  getNewestPoolWeekForYear,
  getPoolWeeksByYear,
} from "~/models/poolweek.server";

import Alert from "~/components/ui/Alert";
import Button from "~/components/ui/Button";
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

export default function BettingPoolList() {
  const { poolWeeks } = useSuperLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const transition = useTransition();

  return (
    <div>
      <h2>Betting Pool Lines by Week</h2>
      {actionData?.message && <Alert message={actionData.message} />}
      <Form method="post">
        <div>
          {actionData?.formError ? (
            <p className="form-validation-error" role="alert">
              {actionData.formError}
            </p>
          ) : null}
          <Button type="submit" disabled={transition.state !== "idle"}>
            Create Next Week
          </Button>
        </div>
      </Form>
      <table className="w-full">
        <thead>
          <tr>
            <th>Week</th>
            <th>Published?</th>
            <th>Actions</th>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
