import type { ActionArgs, LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData, useTransition } from "@remix-run/react";
import z from "zod";

import type { PlayerCreate } from "~/models/players.server";
import { upsertPlayer } from "~/models/players.server";

import Alert from "~/components/ui/Alert";
import Button from "~/components/ui/Button";
import { authenticator, requireAdmin } from "~/services/auth.server";

type ActionData = {
  formError?: string;
  fieldErrors?: {
    url: string | undefined;
  };
  fields?: {
    url: string;
  };
  message?: string;
};

const sleeperJsonNflPlayers = z.record(
  z.object({
    team: z.string().nullable(),
    position: z.string().nullable(),
    player_id: z.string(),
    first_name: z.string(),
    last_name: z.string(),
    full_name: z.string().optional(),
  })
);
type SleeperJsonNflPlayers = z.infer<typeof sleeperJsonNflPlayers>;

export const action = async ({ request }: ActionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });
  requireAdmin(user);

  const sleeperLeagueRes = await fetch(
    `https://api.sleeper.app/v1/players/nfl`
  );
  const sleeperJson: SleeperJsonNflPlayers = sleeperJsonNflPlayers.parse(
    await sleeperLeagueRes.json()
  );

  const promises: Promise<PlayerCreate>[] = [];
  for (const [
    sleeperId,
    { position, first_name, last_name, full_name, team },
  ] of Object.entries(sleeperJson)) {
    const player: PlayerCreate = {
      sleeperId,
      position: position,
      firstName: first_name,
      lastName: last_name,
      fullName: full_name || `${first_name} ${last_name}`,
      nflTeam: team,
    };
    promises.push(upsertPlayer(player));
  }
  await Promise.all(promises);

  return json<ActionData>({ message: "NFL Players have been updated." });
};

export const loader = async ({ request }: LoaderArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });
  requireAdmin(user);

  return {};
};

export default function AdminDataIndex() {
  const actionData = useActionData<ActionData>();
  const transition = useTransition();

  return (
    <>
      <h2>Data Updates</h2>
      {actionData?.message && <Alert message={actionData.message} />}
      <Form method="post">
        <section>
          <h3>Update NFL Players Database</h3>
          <p>
            This will resync all NFL players in the system. You only really need
            to do this if there's a player that's not showing up for some
            reason, or if a player gets traded. Definitely not more than once a
            day, and rarely even once a week. This command will also take likely
            10 seconds or so to run, so be patient with it.
          </p>
          {actionData?.formError ? (
            <p className="form-validation-error" role="alert">
              {actionData.formError}
            </p>
          ) : null}
          <Button
            type="submit"
            name="_action"
            value="resyncNflPlayers"
            disabled={transition.state !== "idle"}
          >
            Resync NFL Players
          </Button>
        </section>
      </Form>
    </>
  );
}
