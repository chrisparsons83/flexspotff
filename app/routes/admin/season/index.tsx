import { type ActionArgs, type LoaderArgs, json } from "@remix-run/node";
import { Form, useActionData, useTransition } from "@remix-run/react";

import type { Season } from "~/models/season.server";
import {
  createSeason,
  getSeasons,
  updateActiveSeason,
  updateSeason,
} from "~/models/season.server";

import Alert from "~/components/ui/Alert";
import Button from "~/components/ui/Button";
import { authenticator, requireAdmin } from "~/services/auth.server";
import { superjson, useSuperLoaderData } from "~/utils/data";

type ActionData = {
  formError?: string;
  message?: string;
};

type LoaderData = {
  seasons: Season[];
};

export const action = async ({ request }: ActionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });
  requireAdmin(user);

  const formData = await request.formData();
  const action = formData.get("_action");
  const seasonId = formData.get("seasonId");

  if (typeof action !== "string" || typeof seasonId !== "string") {
    throw new Error(`Form not generated correctly.`);
  }

  switch (action) {
    case "createSeason": {
      const season = await createSeason({
        year: new Date().getFullYear(),
        isCurrent: false,
        isOpenForRegistration: false,
      });

      return json<ActionData>({
        message: `${season.year} season has been created`,
      });
    }
    case "setActive": {
      const [, season] = await updateActiveSeason(seasonId);

      return json<ActionData>({
        message: `${season.year} season has been made active`,
      });
    }
    case "setRegistration": {
      console.log("setReg");
      const actionToSeason = formData.get("actionToSeason");
      if (typeof actionToSeason !== "string") {
        throw new Error(`Form not generated correctly.`);
      }

      const season = await updateSeason({
        id: seasonId,
        isOpenForRegistration: actionToSeason === "openReg",
      });

      return json<ActionData>({
        message: `${season.year} season registration is now ${
          season.isOpenForRegistration ? "open" : "closed"
        }.`,
      });
    }
  }

  return json<ActionData>({ message: "Nothing has happened." });
};

export const loader = async ({ request }: LoaderArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });
  requireAdmin(user);

  const seasons = await getSeasons();

  return superjson<LoaderData>(
    { seasons },
    { headers: { "x-superjson": "true" } }
  );
};

export default function SeasonIndex() {
  const { seasons } = useSuperLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const transition = useTransition();

  return (
    <>
      <h2 className="mt-0">Season List</h2>
      {actionData?.message && <Alert message={actionData.message} />}
      <table className="w-full">
        <thead>
          <tr>
            <th>Year</th>
            <th>Active?</th>
            <th>Open Registration?</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {seasons.map((season) => {
            const { id, year, isCurrent, isOpenForRegistration } = season;

            return (
              <tr key={id}>
                <td>{year}</td>
                <td>{isCurrent ? "Yes" : "No"}</td>
                <td>{isOpenForRegistration ? "Yes" : "No"}</td>
                <td className="not-prose">
                  {!isCurrent && (
                    <Form method="post">
                      <input type="hidden" name="seasonId" value={id} />
                      <Button type="submit" name="_action" value="setActive">
                        Set Active
                      </Button>
                    </Form>
                  )}
                  {isCurrent && (
                    <Form method="post">
                      <input type="hidden" name="seasonId" value={id} />
                      <input
                        type="hidden"
                        name="actionToSeason"
                        value={!isOpenForRegistration ? "openReg" : "closeReg"}
                      />
                      <Button
                        type="submit"
                        name="_action"
                        value="setRegistration"
                      >
                        {isOpenForRegistration
                          ? "Close Registration"
                          : "Open Registration"}
                      </Button>
                    </Form>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
            value="createSeason"
            disabled={transition.state !== "idle"}
          >
            Create Season for Current Year
          </Button>
        </div>
      </Form>
    </>
  );
}
