import type { LoaderArgs } from "@remix-run/node";
import { Form, useTransition } from "@remix-run/react";

import type { Player } from "~/models/players.server";
import { getActivePlayersByPosition } from "~/models/players.server";

import Button from "~/components/ui/Button";
import { authenticator, requireAdmin } from "~/services/auth.server";
import { superjson, useSuperLoaderData } from "~/utils/data";

type LoaderData = {
  activeQBs: Player[];
};

export const loader = async ({ params, request }: LoaderArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });
  requireAdmin(user);

  const activeQBs = await getActivePlayersByPosition("QB");

  return superjson<LoaderData>(
    { activeQBs },
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
          <label htmlFor="player">
            Name:
            <input
              type="text"
              name="title"
              id="title"
              className="mt-1 block w-full dark:border-0 dark:bg-slate-800"
            />
          </label>
        </div>
        <h3>Available Players</h3>
        <div>
          <Button type="submit" disabled={transition.state !== "idle"}>
            Update Week
          </Button>
        </div>
      </Form>
    </div>
  );
}
