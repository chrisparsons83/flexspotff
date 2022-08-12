import type { ActionArgs, LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData } from "@remix-run/react";
import { authenticator, requireAdmin } from "~/auth.server";
import Button from "~/components/Button";
import type { League } from "~/models/league.server";
import { getLeague } from "~/models/league.server";
import { getLeagues } from "~/models/league.server";
import { superjson, useSuperLoaderData } from "~/utils/data";
import z from "zod";
import { createTeam, getTeams, updateTeam } from "~/models/team.server";
import { SLEEPER_ADMIN_ID } from "~/utils/constants";
import { getUsers } from "~/models/user.server";

type ActionData = {
  message?: string;
};

const sleeperTeamJson = z.array(
  z.object({
    roster_id: z.number(),
    owner_id: z.string(),
    settings: z.object({
      wins: z.number(),
      losses: z.number(),
      ties: z.number(),
      total_moves: z.number(),
      waiver_budget_used: z.number(),
      fpts: z.number(),
      fpts_decimal: z.number(),
      fpts_against: z.number(),
      fpts_against_decimal: z.number(),
    }),
    metadata: z.object({
      streak: z.string(),
      record: z.string(),
    }),
  })
);
type SleeperTeamJson = z.infer<typeof sleeperTeamJson>;

type LoaderData = {
  leagues: League[];
};

export const action = async ({ request }: ActionArgs) => {
  const formData = await request.formData();

  const action = formData.get("action");
  const leagueId = formData.get("leagueId");

  if (typeof action !== "string" || typeof leagueId !== "string") {
    throw new Error(`Form not generated correctly.`);
  }

  const league = await getLeague(leagueId);
  if (!league) {
    throw new Error(`League does not exist`);
  }

  switch (action) {
    case "sync": {
      const url = `https://api.sleeper.app/v1/league/${league.sleeperLeagueId}/rosters`;
      const sleeperTeamsRes = await fetch(url);
      const sleeperTeams: SleeperTeamJson = sleeperTeamJson
        .parse(await sleeperTeamsRes.json())
        .filter((team) => team.owner_id !== SLEEPER_ADMIN_ID);

      const existingTeamsSleeperOwners = (await getTeams(leagueId)).map(
        (team) => [team.sleeperOwnerId, team.id]
      );
      const existingUsersSleeperIds = (await getUsers()).map(
        ({ id, sleeperOwnerID }) => ({ id, sleeperOwnerID })
      );

      const promises: any = [];
      for (const sleeperTeam of sleeperTeams) {
        // build team object
        const systemUser = existingUsersSleeperIds.filter(
          (team) => team.sleeperOwnerID === sleeperTeam.owner_id
        );
        const team = {
          wins: sleeperTeam.settings.wins,
          losses: sleeperTeam.settings.losses,
          ties: sleeperTeam.settings.ties,
          sleeperOwnerId: sleeperTeam.owner_id,
          pointsFor:
            (sleeperTeam.settings.fpts ?? 0) +
            0.01 * (sleeperTeam.settings.fpts_decimal ?? 0),
          pointsAgainst:
            (sleeperTeam.settings.fpts_against ?? 0) +
            0.01 * (sleeperTeam.settings.fpts_against_decimal ?? 0),
          rosterId: sleeperTeam.roster_id,
          leagueId,
          userId: systemUser.length > 0 ? systemUser[0].id : null,
        };
        // if team exists, add ID and add update to promises array
        // else, add create to promises array
        const existingTeam = existingTeamsSleeperOwners.filter(
          (team) => team[0] === sleeperTeam.owner_id
        );
        if (existingTeam.length > 0) {
          promises.push(updateTeam({ id: existingTeam[0][1], ...team }));
        } else {
          promises.push(createTeam(team));
        }
      }
      await Promise.all(promises);
      break;
    }
    default: {
      throw new Error(`Action not supported`);
    }
  }

  return json<ActionData>({ message: "League has been synced." });
};

export const loader = async ({ request }: LoaderArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });
  requireAdmin(user);

  const leagues = await getLeagues();

  return superjson<LoaderData>(
    { leagues },
    { headers: { "x-superjson": "true" } }
  );
};

export default function LeaguesList() {
  const { leagues } = useSuperLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();

  return (
    <>
      <h2>League List</h2>
      {actionData?.message && (
        <div
          className="border-l-4 border-green-500 bg-green-100 p-4 text-green-700"
          role="dialog"
        >
          {actionData?.message}
        </div>
      )}
      <table className="w-full">
        <thead>
          <tr>
            <th>Year</th>
            <th>Name</th>
            <th>Tier</th>
            <th>Sleeper Link</th>
            <th>Draft Link</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {leagues.map((league) => (
            <tr key={league.id}>
              <td>{league.year}</td>
              <td>{league.name}</td>
              <td>{league.tier}</td>
              <td>
                <a
                  href={`https://sleeper.com/leagues/${league.sleeperLeagueId}`}
                >
                  Sleeper
                </a>
              </td>
              <td>
                <a
                  href={`https://sleeper.com/draft/nfl/${league.sleeperDraftId}`}
                >
                  Draft
                </a>
              </td>
              <td className="not-prose">
                <Form method="post">
                  <input type="hidden" name="leagueId" value={league.id} />
                  <Button type="submit" name="action" value="sync">
                    Sync
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
