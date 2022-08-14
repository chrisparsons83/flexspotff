import type { ActionArgs, LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData, useTransition } from "@remix-run/react";
import { useState } from "react";
import { authenticator, requireAdmin } from "~/auth.server";
import FSquaredEntryFormSection from "~/components/layout/f-squared/FSquaredEntryFormSection";
import Button from "~/components/ui/Button";
import type { League } from "~/models/league.server";
import { getLeaguesByYear } from "~/models/league.server";
import { getTeamsInSeason } from "~/models/team.server";
import { CURRENT_YEAR } from "~/utils/constants";
import { superjson, useSuperLoaderData } from "~/utils/data";
import z from "zod";
import Alert from "~/components/ui/Alert";

type ActionData = {
  formError?: string;
  fieldErrors?: {
    userId: string | undefined;
  };
  fields?: {
    userId: string;
  };
  message?: string;
};

type LoaderData = {
  leagues: Record<string, Awaited<ReturnType<typeof getTeamsInSeason>>>;
};

const formEntry = z.string().array().length(2);
type FormEntry = z.infer<typeof formEntry>;

export const action = async ({
  request,
}: ActionArgs): Promise<Response | ActionData> => {
  const leagues = await getLeaguesByYear(CURRENT_YEAR);
  const formData = await request.formData();

  const fSquaredForm: Record<string, FormEntry> = {};
  leagues.forEach((league) => {
    const entry = formEntry.parse(formData.getAll(league.name));
    fSquaredForm[league.name] = entry;
  });

  console.log(fSquaredForm);

  return json<ActionData>({ message: "Your entry has been updated." });
};

export const loader = async ({ request }: LoaderArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });

  // TODO: REMOVE THIS WHEN GOING LIVE
  requireAdmin(user);

  // Get teams
  const teams = await getTeamsInSeason(CURRENT_YEAR);

  // Make record object for simplicity
  const leagues: LoaderData["leagues"] = {};
  for (const team of teams) {
    if (leagues[team.league.name]) {
      leagues[team.league.name].push(team);
    } else {
      leagues[team.league.name] = [team];
    }
  }

  return superjson<LoaderData>(
    { leagues },
    { headers: { "x-superjson": "true" } }
  );
};

export default function FSquaredMyEntry() {
  const actionData = useActionData<ActionData>();
  const { leagues } = useSuperLoaderData<typeof loader>();
  const transition = useTransition();
  const [validLeagueCheck, setValidLeagueCheck] = useState<
    Record<string, boolean>
  >({});

  const numberOfLeagues = Object.keys(leagues).length;

  const handleValidFormChange = (
    leagueName: League["id"],
    isValid: boolean
  ) => {
    setValidLeagueCheck((prevState) => {
      const state = { ...prevState };
      state[leagueName] = isValid;
      return state;
    });
  };

  const isValidForm =
    Object.keys(validLeagueCheck).length === numberOfLeagues &&
    Object.values(validLeagueCheck).every(Boolean);

  const buttonText =
    transition.state === "submitting"
      ? "Submitting..."
      : transition.state === "loading"
      ? "Submitted!"
      : "Submit";

  // TODO: add reloadDocument to Form element
  return (
    <div>
      <h2>My F² Entry</h2>
      <p>
        Pick two teams from each league. Get points based on how many fantasy
        points they earn during the season. Most combined points wins.
      </p>
      <p>
        You are able to change your picks for a league until that league's draft
        starts. Teams are listed by their draft order.
      </p>
      {actionData?.message && <Alert message={actionData.message} />}
      <Form method="post">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Object.entries(leagues).map(([leagueName, teams]) => (
            <FSquaredEntryFormSection
              key={leagueName}
              leagueName={leagueName}
              teams={teams}
              isLeagueValid={handleValidFormChange}
            />
          ))}
        </div>
        <div className="block p-4">
          {actionData?.formError ? (
            <p className="form-validation-error" role="alert">
              {actionData.formError}
            </p>
          ) : null}
          <Button
            type="submit"
            disabled={!isValidForm || transition.state !== "idle"}
          >
            {buttonText}
          </Button>
        </div>
      </Form>
    </div>
  );
}
