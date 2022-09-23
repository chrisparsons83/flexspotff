import type { ActionArgs, LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form } from "@remix-run/react";

import type { Cup } from "~/models/cup.server";
import { getCup } from "~/models/cup.server";
import type { CupWeek } from "~/models/cupweek.server";
import { updateCupWeek } from "~/models/cupweek.server";
import { getCupWeeks } from "~/models/cupweek.server";

import Button from "~/components/ui/Button";
import { authenticator, requireAdmin } from "~/services/auth.server";
import { superjson, useSuperLoaderData } from "~/utils/data";

type LoaderData = {
  message?: string;
  cup: Cup;
  cupWeeks: CupWeek[];
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

export const action = async ({ params, request }: ActionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });
  requireAdmin(user);

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
  }

  return json<ActionData>({ message: "Nothing has happened." });
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

  return superjson<LoaderData>(
    { cup, cupWeeks },
    { headers: { "x-superjson": "true" } }
  );
};

export default function CupAdministerPage() {
  const { cup, cupWeeks } = useSuperLoaderData<typeof loader>();

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

  return (
    <>
      <h2>Administer {cup.year} Cup</h2>
      <Form method="post">
        <table>
          <thead>
            <tr>
              <th>Week</th>
              <th>Map</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {cupWeeks.map((cupWeek) => (
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
                <td>Action?</td>
              </tr>
            ))}
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
