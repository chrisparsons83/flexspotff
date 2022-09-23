import type { ActionArgs, LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData } from "@remix-run/react";

import type { Cup } from "~/models/cup.server";
import { getCup } from "~/models/cup.server";
import type { CupTeam } from "~/models/cupteam.server";
import { createCupTeam } from "~/models/cupteam.server";
import type { CupWeek } from "~/models/cupweek.server";
import { updateCupWeek } from "~/models/cupweek.server";
import { getCupWeeks } from "~/models/cupweek.server";
import { getTeamGameMultiweekTotals } from "~/models/teamgame.server";

import Alert from "~/components/ui/Alert";
import Button from "~/components/ui/Button";
import { authenticator, requireAdmin } from "~/services/auth.server";
import { superjson, useSuperLoaderData } from "~/utils/data";

type LoaderData = {
  message?: string;
  cup: Cup;
  cupWeeks: CupWeek[];
  actionWeeks: Map<string, number>;
};

type ActionData = {
  message?: string;
};

type CupMappingOptions = {
  label: string;
  value:
    | "PENDING"
    | "SEEDING"
    | "ROUND_OF_64"
    | "ROUND_OF_32"
    | "ROUND_OF_16"
    | "ROUND_OF_8"
    | "ROUND_OF_4"
    | "ROUND_OF_2";
};

const selectOptions: CupMappingOptions[] = [
  {
    label: "Pending",
    value: "PENDING",
  },
  {
    label: "Seeding Week",
    value: "SEEDING",
  },
  {
    label: "Round of 64",
    value: "ROUND_OF_64",
  },
  {
    label: "Round of 32",
    value: "ROUND_OF_32",
  },
  {
    label: "Round of 16",
    value: "ROUND_OF_16",
  },
  {
    label: "Quarterfinals",
    value: "ROUND_OF_8",
  },
  {
    label: "Semifinals",
    value: "ROUND_OF_4",
  },
  {
    label: "Finals",
    value: "ROUND_OF_2",
  },
];

export const action = async ({ params, request }: ActionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });
  requireAdmin(user);

  const cupId = params.id;
  if (!cupId) throw new Error("Missing cup id");

  const cup = await getCup(cupId);
  if (!cup) throw new Error("Invalid cup");

  const formData = await request.formData();
  const action = formData.get("_action");

  switch (action) {
    case "updateCup": {
      const promises: Promise<CupWeek>[] = [];
      for (const [key, mapping] of formData.entries()) {
        const id = key.replace("week-", "");

        if (id === "_action") {
          continue;
        }

        if (mapping && typeof mapping === "string") {
          promises.push(updateCupWeek(id, { mapping }));
        }
      }
      await Promise.all(promises);

      return json<ActionData>({
        message: "Cup week mappings have been updated.",
      });
    }
    case "SEEDING": {
      const weeksToScore = (await getCupWeeks(cupId))
        .filter((cupWeek) => cupWeek.mapping === "SEEDING")
        .map((cupWeek) => cupWeek.week);

      const scores = await getTeamGameMultiweekTotals(weeksToScore);
      const promises: Promise<CupTeam>[] = [];
      let seed = 1;
      for (const { teamId } of scores) {
        promises.push(
          createCupTeam({
            cupId,
            teamId,
            seed,
          })
        );
        seed++;
      }
      await Promise.all(promises);

      return json<ActionData>({
        message: "Seeding created.",
      });
    }
    default: {
      return json<ActionData>({
        message: "Default thing happened.",
      });
    }
  }
};

export const loader = async ({ params, request }: LoaderArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });
  requireAdmin(user);

  const id = params.id;
  if (!id) throw new Error("Missing ID");

  const cup = await getCup(id);
  if (!cup) throw new Error("No cup found");

  const cupWeeks = await getCupWeeks(cup.id);

  const actionWeeks: Map<string, number> = new Map();

  for (const cupWeek of cupWeeks) {
    const existingValue = actionWeeks.get(cupWeek.mapping);
    if (!existingValue || existingValue < cupWeek.week) {
      actionWeeks.set(cupWeek.mapping, cupWeek.week);
    }
  }

  return superjson<LoaderData>(
    { cup, cupWeeks, actionWeeks },
    { headers: { "x-superjson": "true" } }
  );
};

export default function CupAdministerPage() {
  const actionData = useActionData<ActionData>();
  const { cup, cupWeeks, actionWeeks } = useSuperLoaderData<typeof loader>();

  return (
    <>
      <h2>Administer {cup.year} Cup</h2>
      {actionData?.message && <Alert message={actionData.message} />}
      <Form method="post" reloadDocument>
        <table>
          <thead>
            <tr>
              <th>Week</th>
              <th>Map</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {cupWeeks.map((cupWeek, index) => {
              const action =
                actionWeeks.get(cupWeek.mapping) === cupWeek.week
                  ? cupWeek.mapping
                  : undefined;
              const buttonText =
                action === "SEEDING" ? "Set Seeds" : "Score Week";

              return (
                <tr key={cupWeek.id}>
                  <td>{cupWeek.week}</td>
                  <td>
                    <select
                      name={`week-${cupWeek.id}`}
                      id={`week-${cupWeek.id}`}
                      defaultValue={cupWeek.mapping}
                      className="form-select dark:border-0 dark:bg-slate-800"
                    >
                      {selectOptions.map((option) => (
                        <option value={option.value} key={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {action && (
                      <Button
                        type="submit"
                        name="_action"
                        value={cupWeek.mapping}
                      >
                        {buttonText}
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div>
          <Button type="submit" name="_action" value="updateCup">
            Update Mapping
          </Button>
        </div>
      </Form>
    </>
  );
}
