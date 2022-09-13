import type { ActionArgs, LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, Link, useActionData, useTransition } from "@remix-run/react";
import z from "zod";

import type { QBStreamingWeek } from "~/models/qbstreamingweek.server";
import { updateQBStreamingWeek } from "~/models/qbstreamingweek.server";
import { getQBStreamingWeek } from "~/models/qbstreamingweek.server";
import {
  createQBStreamingWeek,
  getQBStreamingWeeks,
} from "~/models/qbstreamingweek.server";
import type { QBStreamingWeekOption } from "~/models/qbstreamingweekoption.server";
import { updateQBStreamingWeekOptionScore } from "~/models/qbstreamingweekoption.server";

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

// If the below fields do not exist, it is safe to assume they are 0.
const sleeperJsonStats = z.record(
  z.object({
    pts_ppr: z.number().optional(),
    pass_yd: z.number().optional(),
    pass_td: z.number().optional(),
    rush_yd: z.number().optional(),
    rush_td: z.number().optional(),
    rec_yd: z.number().optional(),
    rec_td: z.number().optional(),
    pass_int: z.number().optional(),
    fum_lost: z.number().optional(),
    rush_2pt: z.number().optional(),
    rec_2pt: z.number().optional(),
    pass_2pt: z.number().optional(),
  })
);
type SleeperJsonStats = z.infer<typeof sleeperJsonStats>;

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
    case "scoreWeek": {
      const weekNumberString = formData.get("weekNumber");
      const yearString = formData.get("year");
      const id = formData.get("id");

      if (
        typeof weekNumberString !== "string" ||
        typeof yearString !== "string" ||
        typeof id !== "string"
      ) {
        throw new Error("Form has not been formed correctly");
      }

      const qbStreamingWeek = await getQBStreamingWeek(id);
      if (!qbStreamingWeek) throw new Error("QB Streaming Week not found");

      const year = Number(yearString);
      const weekNumber = Number(weekNumberString);

      const sleeperLeagueRes = await fetch(
        `https://api.sleeper.app/v1/stats/nfl/regular/${year}/${weekNumber}?position[]=QB`
      );
      const sleeperJson: SleeperJsonStats = sleeperJsonStats.parse(
        await sleeperLeagueRes.json()
      );
      const promises: Promise<QBStreamingWeekOption>[] = [];
      for (const qbStreamingOption of qbStreamingWeek.QBStreamingWeekOptions) {
        const stats = sleeperJson[qbStreamingOption.player.sleeperId] || {};
        const score =
          Math.round(
            100 *
              (0.04 * (stats.pass_yd || 0) +
                4 * (stats.pass_td || 0) +
                0.1 * (stats.rush_yd || 0) +
                6 * (stats.rush_td || 0) +
                0.1 * (stats.rec_yd || 0) +
                6 * (stats.rec_td || 0) +
                -2 * (stats.fum_lost || 0) +
                -2 * (stats.pass_int || 0) +
                2 * (stats.pass_2pt || 0) +
                2 * (stats.rush_2pt || 0) +
                2 * (stats.rec_2pt || 0))
          ) / 100;
        promises.push(
          updateQBStreamingWeekOptionScore(qbStreamingOption.id, score)
        );
      }
      await Promise.all(promises);

      await updateQBStreamingWeek({
        id: qbStreamingWeek.id,
        isOpen: qbStreamingWeek.isOpen,
        isScored: true,
        year: qbStreamingWeek.year,
        week: qbStreamingWeek.week,
      });

      return json<ActionData>({ message: "Week has been scored." });
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
                  <input type="hidden" name="id" value={qbStreamingWeek.id} />
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
