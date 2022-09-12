import type { ActionArgs, LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData, useTransition } from "@remix-run/react";
import z from "zod";

import { getLeaguesByYear } from "~/models/league.server";
import { createNflTeams, getNflTeams } from "~/models/nflteam.server";
import type { PlayerCreate } from "~/models/players.server";
import { upsertPlayer } from "~/models/players.server";
import type { TeamGame } from "~/models/teamgame.server";
import { getTeamGamesByYearAndWeek } from "~/models/teamgame.server";
import { upsertTeamGame } from "~/models/teamgame.server";

import Alert from "~/components/ui/Alert";
import Button from "~/components/ui/Button";
import { syncNflGameWeek } from "~/libs/syncs.server";
import { authenticator, requireAdmin } from "~/services/auth.server";
import { CURRENT_YEAR } from "~/utils/constants";

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

const sleeperJsonNflState = z.object({
  week: z.number(),
  season_type: z.string(),
  season_start_date: z.string(),
  season: z.string(),
  display_week: z.number(),
});
type SleeperJsonNflState = z.infer<typeof sleeperJsonNflState>;

const sleeperJsonWeeklyMatchup = z.array(
  z.object({
    starters: z.array(z.string()),
    roster_id: z.number(),
    points: z.number(),
    matchup_id: z.number(),
  })
);
type SleeperJsonWeeklyMatchup = z.infer<typeof sleeperJsonWeeklyMatchup>;

export const action = async ({ request }: ActionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });
  requireAdmin(user);

  const formData = await request.formData();
  const action = formData.get("_action");

  switch (action) {
    case "resyncNflPlayers": {
      const sleeperLeagueRes = await fetch(
        `https://api.sleeper.app/v1/players/nfl`
      );
      const sleeperJson: SleeperJsonNflPlayers = sleeperJsonNflPlayers.parse(
        await sleeperLeagueRes.json()
      );

      const nflTeamSleeperIdToLocalIdMap: Map<string, string> = new Map();
      const nflTeams = await getNflTeams();
      for (const nflTeam of nflTeams) {
        nflTeamSleeperIdToLocalIdMap.set(nflTeam.sleeperId, nflTeam.id);
      }

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
          currentNFLTeamId: team
            ? nflTeamSleeperIdToLocalIdMap.get(team) || null
            : null,
        };
        promises.push(upsertPlayer(player));

        if (promises.length >= 50) {
          await Promise.all(promises);
          promises.length = 0;
        }
      }
      await Promise.all(promises);

      return json<ActionData>({ message: "NFL Players have been updated." });
    }
    case "resyncNflGames": {
      // Set up teams (this needs to be optimized to not do this)
      await createNflTeams();

      // The array one-liner there makes an array of numbers from 1 to 18.
      await syncNflGameWeek(
        CURRENT_YEAR,
        Array.from({ length: 18 }, (_, i) => i + 1)
      );

      return json<ActionData>({ message: "NFL Games have been updated." });
    }
    case "resyncCurrentWeekScores": {
      const sleeperLeagueRes = await fetch(
        `https://api.sleeper.app/v1/state/nfl`
      );
      const sleeperJson: SleeperJsonNflState = sleeperJsonNflState.parse(
        await sleeperLeagueRes.json()
      );

      const leagues = await getLeaguesByYear(CURRENT_YEAR);
      const teams = leagues.flatMap((league) => league.teams);
      console.log(teams);

      const existingTeamGames = await getTeamGamesByYearAndWeek(
        CURRENT_YEAR,
        sleeperJson.week
      );

      const leagueMatchupPromises: Promise<Response>[] = [];
      for (const league of leagues) {
        const url = `https://api.sleeper.app/v1/league/${league.sleeperLeagueId}/matchups/${sleeperJson.week}`;
        leagueMatchupPromises.push(fetch(url));
      }
      const leagueMatchupResponses = await Promise.all(leagueMatchupPromises);

      const teamGameUpserts: Promise<TeamGame>[] = [];
      for (const response of leagueMatchupResponses) {
        const sleeperLeagueId = new URL(response.url).pathname.split("/")[3];
        const matchups: SleeperJsonWeeklyMatchup =
          sleeperJsonWeeklyMatchup.parse(await response.json());
        for (const matchup of matchups) {
          const league = leagues.find(
            (league) => league.sleeperLeagueId === sleeperLeagueId
          );
          if (!league) continue;

          const team = teams.find(
            (team) =>
              team.leagueId === league.id && team.rosterId === matchup.roster_id
          );
          if (!team) continue;

          const existingTeamGame = existingTeamGames.find(
            (teamGame) =>
              teamGame.teamId === team.id && teamGame.week === sleeperJson.week
          );

          teamGameUpserts.push(
            upsertTeamGame({
              id: existingTeamGame?.id,
              sleeperMatchupId: matchup.matchup_id,
              week: sleeperJson.week,
              starters: matchup.starters,
              pointsScored: matchup.points,
              teamId: team.id,
            })
          );
        }
      }
      await Promise.all(teamGameUpserts);

      return json<ActionData>({ message: "League games have been synced." });
    }
  }

  return json<ActionData>({ message: "Nothing was updated." });
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
      <p>This is a good list of things to eventually automate.</p>
      {actionData?.message && <Alert message={actionData.message} />}
      <Form method="post">
        <section>
          <h3>Update NFL Games</h3>
          <p>
            This will resync all NFL games in the system. This should probably
            be run on Monday nights late or maybe Tuesday morning.
          </p>
          {actionData?.formError ? (
            <p className="form-validation-error" role="alert">
              {actionData.formError}
            </p>
          ) : null}
          <Button
            type="submit"
            name="_action"
            value="resyncNflGames"
            disabled={transition.state !== "idle"}
          >
            Resync NFL Games
          </Button>
        </section>
        <section>
          <h3>Update Current Week Scores</h3>
          <p>
            This will resync all current week scores in the system. This can be
            run at any time safely.
          </p>
          {actionData?.formError ? (
            <p className="form-validation-error" role="alert">
              {actionData.formError}
            </p>
          ) : null}
          <Button
            type="submit"
            name="_action"
            value="resyncCurrentWeekScores"
            disabled={transition.state !== "idle"}
          >
            Resync Current Week Scores
          </Button>
        </section>
        <section>
          <h3>Update NFL Players Database</h3>
          <p>
            This will resync all NFL players in the system. You only really need
            to do this if there's a player that's not showing up for some
            reason, or if a player gets traded. Definitely not more than once a
            day, and rarely even once a week. This command takes like 30 seconds
            to run, so be patient with it.
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
