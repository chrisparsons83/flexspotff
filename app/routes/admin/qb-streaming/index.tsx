import type { ActionArgs, LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, Link, useActionData, useTransition } from "@remix-run/react";

import type { QBStreamingWeek } from "~/models/qbstreamingweek.server";
import {
  createQBStreamingWeek,
  getQBStreamingWeeks,
} from "~/models/qbstreamingweek.server";

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
  qbStreamingWeeks: QBStreamingWeek[];
};

export const action = async ({ request }: ActionArgs) => {
  const formData = await request.formData();
  const action = formData.get("_action");

  switch (action) {
    case "createNewWeek": {
      // Get max week of season, then add one
      const latestWeek = await getQBStreamingWeeks(CURRENT_YEAR);
      const newWeek = latestWeek.length > 0 ? latestWeek[0].week + 1 : 1;

      // Create new PoolWeek
      await createQBStreamingWeek({
        year: CURRENT_YEAR,
        week: newWeek,
        isOpen: false,
        isScored: false,
      });

      return json<ActionData>({ message: "Week has been created." });
    }
  }

  return json<ActionData>({ message: "Nothing has happened." });
};

export const loader = async ({ request }: LoaderArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });
  requireAdmin(user);

  const qbStreamingWeeks = await getQBStreamingWeeks(CURRENT_YEAR);

  return superjson<LoaderData>(
    { qbStreamingWeeks },
    { headers: { "x-superjson": "true" } }
  );
};

export default function AdminQBStreaming() {
  const { qbStreamingWeeks } = useSuperLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const transition = useTransition();

  return (
    <>
      <h2>QB Streaming</h2>
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
            <th>Scored?</th>
            <th>Edit</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {qbStreamingWeeks.map((qbStreamingWeek) => (
            <tr key={qbStreamingWeek.id}>
              <td>{qbStreamingWeek.week}</td>
              <td>{qbStreamingWeek.isOpen ? "Yes" : "No"}</td>
              <td>{qbStreamingWeek.isScored ? "Yes" : "No"}</td>
              <td>
                <Link to={`./${qbStreamingWeek.id}`}>Edit Week</Link>
              </td>
              <td>
                <Form method="post">
                  <input
                    type="hidden"
                    name="weekNumber"
                    value={qbStreamingWeek.week}
                  />
                  <input
                    type="hidden"
                    name="year"
                    value={qbStreamingWeek.year}
                  />
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
    </>
  );
}
