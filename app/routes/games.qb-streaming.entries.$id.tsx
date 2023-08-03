import type { ActionArgs, LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData, useTransition } from "@remix-run/react";

import { getNflGameById } from "~/models/nflgame.server";
import type { QBSelection } from "~/models/qbselection.server";
import {
  createQBSelection,
  getQBSelection,
  updateQBSelection,
} from "~/models/qbselection.server";
import { getQBStreamingWeek } from "~/models/qbstreamingweek.server";
import type { User } from "~/models/user.server";

import Alert from "~/components/ui/Alert";
import Button from "~/components/ui/Button";
import { authenticator } from "~/services/auth.server";
import { superjson, useSuperLoaderData } from "~/utils/data";

type ActionData = {
  message?: string;
};

type LoaderData = {
  user: User;
  qbStreamingWeek: Awaited<ReturnType<typeof getQBStreamingWeek>>;
  qbSelection: Awaited<ReturnType<typeof getQBSelection>>;
};

export const action = async ({ params, request }: ActionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });

  const qbStreamingWeekId = params.id;
  if (!qbStreamingWeekId) throw new Error("Missing streaming week id");

  const currentWeek = await getQBStreamingWeek(qbStreamingWeekId);
  if (!currentWeek) throw new Error("Week does not exist");

  const existingSelection = await getQBSelection(qbStreamingWeekId, user.id);
  const newSelections: Partial<
    Pick<QBSelection, "standardPlayerId" | "deepPlayerId">
  > = {};

  const formData = await request.formData();
  const standardPlayerId = formData.get("standardPlayerId");
  if (typeof standardPlayerId !== "string") {
    throw new Error("Bad form submit for standardPlayerId");
  }
  const deepPlayerId = formData.get("deepPlayerId");
  if (typeof deepPlayerId !== "string") {
    throw new Error("Bad form submit for deepPlayerId");
  }

  // Check both players, make sure both existing player and new player are not locked.
  const standardQBStreamingOption = currentWeek.QBStreamingWeekOptions.find(
    (option) => option.id === standardPlayerId
  );
  if (!standardQBStreamingOption)
    throw new Error("Standard QB Streaming Option not found");
  const standardNFLGame = await getNflGameById(
    standardQBStreamingOption.nflGameId
  );
  if (!standardNFLGame) throw new Error("Game not found");
  if (standardNFLGame.gameStartTime > new Date()) {
    newSelections.standardPlayerId = standardPlayerId;
  }

  const deepQBStreamingOption = currentWeek.QBStreamingWeekOptions.find(
    (option) => option.id === deepPlayerId
  );
  if (!deepQBStreamingOption)
    throw new Error("Deep QB Streaming Option not found");
  const deepNFLGame = await getNflGameById(deepQBStreamingOption.nflGameId);
  if (!deepNFLGame) throw new Error("Game not found");
  if (deepNFLGame.gameStartTime > new Date()) {
    newSelections.deepPlayerId = deepPlayerId;
  }

  // Update or create selection
  if (existingSelection) {
    await updateQBSelection({
      id: existingSelection.id,
      qbStreamingWeekId: existingSelection.qbStreamingWeekId,
      standardPlayerId: existingSelection.standardPlayerId,
      deepPlayerId: existingSelection.deepPlayerId,
      userId: existingSelection.userId,
      ...newSelections,
    });
    return json<ActionData>({ message: "Your picks have been updated." });
  } else {
    if (!newSelections.standardPlayerId)
      throw new Error("No new standard player ID");
    if (!newSelections.deepPlayerId) throw new Error("No new deep player ID");
    await createQBSelection({
      userId: user.id,
      standardPlayerId: newSelections.standardPlayerId,
      deepPlayerId: newSelections.deepPlayerId,
      qbStreamingWeekId,
    });
    return json<ActionData>({ message: "Your picks have been created." });
  }
};

export const loader = async ({ params, request }: LoaderArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });

  const id = params.id;
  if (!id) throw new Error(`No QB streaming week ID found`);

  const qbStreamingWeek = await getQBStreamingWeek(id);
  if (!qbStreamingWeek) throw new Error(`QB Streaming Week ID does not exist`);

  const qbSelection = await getQBSelection(id, user.id);

  return superjson<LoaderData>(
    { user, qbStreamingWeek, qbSelection },
    { headers: { "x-superjson": "true" } }
  );
};

export default function QBStreamingYearWeekEntry() {
  const actionData = useActionData<ActionData>();
  const { qbStreamingWeek, qbSelection } = useSuperLoaderData<typeof loader>();
  const transition = useTransition();

  return (
    <>
      <h2>Edit Streaming Picks for Week {qbStreamingWeek?.week}</h2>
      {actionData?.message && <Alert message={actionData.message} />}
      <Form method="POST">
        <div className="mb-4">
          <label htmlFor="standardPlayerId">
            Standard Selection:
            <select
              defaultValue={qbSelection?.standardPlayerId}
              name="standardPlayerId"
              id="standardPlayerId"
              required
              className="form-select mt-1 block w-full dark:border-0 dark:bg-slate-800"
              disabled={
                !!qbSelection &&
                qbSelection?.standardPlayer.nflGame.gameStartTime < new Date()
              }
            >
              <option value=""></option>
              {qbStreamingWeek?.QBStreamingWeekOptions.map((qbOption) => {
                const matchup =
                  qbOption.player.currentNFLTeamId ===
                  qbOption.nflGame.homeTeamId
                    ? `vs ${qbOption.nflGame.awayTeam.mascot}`
                    : `@ ${qbOption.nflGame.homeTeam.mascot}`;

                return (
                  <option
                    key={qbOption.id}
                    value={qbOption.id}
                    disabled={qbOption.nflGame.gameStartTime < new Date()}
                  >
                    {qbOption.player.fullName} {matchup}
                  </option>
                );
              })}
            </select>
          </label>
        </div>
        <div className="mb-4">
          <label htmlFor="deepPlayerId">
            Deep Selection:
            <select
              defaultValue={qbSelection?.deepPlayerId}
              name="deepPlayerId"
              id="deepPlayerId"
              required
              className="form-select mt-1 block w-full dark:border-0 dark:bg-slate-800"
              disabled={
                !!qbSelection &&
                qbSelection?.deepPlayer.nflGame.gameStartTime < new Date()
              }
            >
              <option value=""></option>
              {qbStreamingWeek?.QBStreamingWeekOptions.filter(
                (qbOption) => qbOption.isDeep
              ).map((qbOption) => {
                const matchup =
                  qbOption.player.currentNFLTeamId ===
                  qbOption.nflGame.homeTeamId
                    ? `vs ${qbOption.nflGame.awayTeam.mascot}`
                    : `@ ${qbOption.nflGame.homeTeam.mascot}`;

                return (
                  <option
                    key={qbOption.id}
                    value={qbOption.id}
                    disabled={qbOption.nflGame.gameStartTime < new Date()}
                  >
                    {qbOption.player.fullName} {matchup}
                  </option>
                );
              })}
            </select>
          </label>
        </div>
        <div>
          <Button
            type="submit"
            name="_action"
            value="saveOptions"
            disabled={transition.state !== "idle"}
          >
            Update Entry
          </Button>
        </div>
      </Form>
    </>
  );
}
