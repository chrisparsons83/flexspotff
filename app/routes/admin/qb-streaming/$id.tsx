import type { LoaderArgs } from "@remix-run/node";
import { Form, useTransition } from "@remix-run/react";

import type { Player } from "~/models/players.server";
import { getActivePlayersByPosition } from "~/models/players.server";
import type { QBStreamingWeek } from "~/models/qbstreamingweek.server";
import { getQBStreamingWeek } from "~/models/qbstreamingweek.server";

import Button from "~/components/ui/Button";
import { authenticator, requireAdmin } from "~/services/auth.server";
import { superjson, useSuperLoaderData } from "~/utils/data";

type LoaderData = {
  activeQBs: Player[];
  qbStreamingWeek: QBStreamingWeek;
};

export const loader = async ({ params, request }: LoaderArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });
  requireAdmin(user);

  const qbStreamingWeekId = params.id;
  if (!qbStreamingWeekId) throw new Error(`Missing QB Streaming Week ID`);

  const qbStreamingWeek = await getQBStreamingWeek(qbStreamingWeekId);
  if (!qbStreamingWeek) throw new Error(`QB Streaming week does not exist`);

  const activeQBs = await getActivePlayersByPosition("QB");

  return superjson<LoaderData>(
    { activeQBs, qbStreamingWeek },
    { headers: { "x-superjson": "true" } }
  );
};

export default function AdminSpreadPoolYearWeek() {
  const { activeQBs } = useSuperLoaderData<typeof loader>();
  const transition = useTransition();

  return (
    <div>
      <h2>Edit Picks for Week</h2>
      <Form method="post">
        <h3>Add Player</h3>
        <div>
          <select
            name="playerId"
            className="form-select mt-1 block w-full dark:border-0 dark:bg-slate-800"
          >
            {activeQBs.map((qb) => (
              <option key={qb.id} value={qb.id}>
                {qb.lastName}, {qb.firstName}: {qb.nflTeam}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="isDeep">
            <input
              type="checkbox"
              name="isDeep"
              id="isDeep"
              defaultChecked={true}
            />{" "}
            Available in deep player pool
          </label>
        </div>
        <div className="pt-4">
          <Button
            type="submit"
            name="_action"
            value="addPlayer"
            disabled={transition.state !== "idle"}
          >
            Add Player
          </Button>
        </div>
        <h3>Available Players</h3>
        <h3>Week Settings</h3>
        <label htmlFor="isOpen">
          <input type="checkbox" name="isOpen" id="isOpen" /> Week is active for
          selections
        </label>
        <div>
          <Button
            type="submit"
            name="_action"
            value="updateWeek"
            disabled={transition.state !== "idle"}
          >
            Update Week
          </Button>
        </div>
      </Form>
    </div>
  );
}
