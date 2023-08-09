import type { ActionArgs, LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData } from "@remix-run/react";
import { DateTime } from "luxon";
import z from "zod";

import { getLeague, getLeagues, updateLeague } from "~/models/league.server";
import type { Team } from "~/models/team.server";
import { createTeam, getTeams, updateTeam } from "~/models/team.server";
import { getUsers } from "~/models/user.server";

import Alert from "~/components/ui/Alert";
import Button from "~/components/ui/Button";
import { syncAdp } from "~/libs/syncs.server";
import { authenticator, requireAdmin } from "~/services/auth.server";
import { SLEEPER_ADMIN_ID } from "~/utils/constants";
import { superjson, useSuperLoaderData } from "~/utils/data";

type ActionData = {
  message?: string;
};

const sleeperTeamJson = z.array(
  z.object({
    roster_id: z.number(),
    owner_id: z.string().nullable(),
    settings: z.object({
      wins: z.number(),
      losses: z.number(),
      ties: z.number(),
      total_moves: z.number(),
      waiver_budget_used: z.number(),
      fpts: z.number().optional(),
      fpts_decimal: z.number().optional(),
      fpts_against: z.number().optional(),
      fpts_against_decimal: z.number().optional(),
    }),
    metadata: z
      .object({
        streak: z.string().optional(),
        record: z.string().optional(),
      })
      .nullable(),
  })
);
type SleeperTeamJson = z.infer<typeof sleeperTeamJson>;
const sleeperDraftJson = z.object({
  status: z.string(),
  season: z.string(),
  start_time: z.number().nullable(),
  draft_order: z.record(z.number()).nullable(),
});
type SleeperDraftJson = z.infer<typeof sleeperDraftJson>;

type LoaderData = {
  leagues: Awaited<ReturnType<typeof getLeagues>>;
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
      const teamsUrl = `https://api.sleeper.app/v1/league/${league.sleeperLeagueId}/rosters`;
      const draftsUrl = `https://api.sleeper.app/v1/draft/${league.sleeperDraftId}`;
      const [sleeperTeamsRes, sleeperDraftRes] = await Promise.all([
        fetch(teamsUrl),
        fetch(draftsUrl),
      ]);

      const sleeperTeams: SleeperTeamJson = sleeperTeamJson
        .parse(await sleeperTeamsRes.json())
        .filter((team) => team.owner_id && team.owner_id !== SLEEPER_ADMIN_ID);
      const sleeperDraft: SleeperDraftJson = sleeperDraftJson.parse(
        await sleeperDraftRes.json()
      );

      const existingTeamsSleeperOwners = (await getTeams(leagueId)).map(
        (team) => [team.sleeperOwnerId, team.id]
      );
      const existingUsersSleeperIds = (await getUsers()).map(
        ({ id, sleeperOwnerID }) => ({ id, sleeperOwnerID })
      );

      if (sleeperDraft.start_time) {
        league.draftDateTime = DateTime.fromSeconds(
          sleeperDraft.start_time / 1000
        ).toJSDate();
        await updateLeague(league);
      }

      const promises: Promise<Team>[] = [];
      for (const sleeperTeam of sleeperTeams) {
        if (!sleeperTeam.owner_id) continue;
        // build team object
        const systemUser = existingUsersSleeperIds.filter(
          (team) => team.sleeperOwnerID === sleeperTeam.owner_id
        );
        const team = {
          wins: sleeperTeam.settings.wins,
          losses: sleeperTeam.settings.losses,
          ties: sleeperTeam.settings.ties,
          sleeperOwnerId: sleeperTeam.owner_id!,
          pointsFor:
            (sleeperTeam.settings.fpts ?? 0) +
            0.01 * (sleeperTeam.settings.fpts_decimal ?? 0),
          pointsAgainst:
            (sleeperTeam.settings.fpts_against ?? 0) +
            0.01 * (sleeperTeam.settings.fpts_against_decimal ?? 0),
          rosterId: sleeperTeam.roster_id,
          leagueId,
          draftPosition: sleeperDraft.draft_order
            ? sleeperDraft.draft_order[sleeperTeam.owner_id]
            : null,
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

  await syncAdp(league);

  return json<ActionData>({
    message: `${league.year} ${league.name} League has been synced.`,
  });
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
      {actionData?.message && <Alert message={actionData.message} />}
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
                  Draft ({league.teams.length} / 12)
                </a>
                <br />
                {league.draftDateTime?.toLocaleString() || ""}
              </td>
              <td className="not-prose">
                <Form method="POST">
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
