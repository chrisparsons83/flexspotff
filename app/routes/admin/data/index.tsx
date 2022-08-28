import type { ActionArgs, LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData, useTransition } from "@remix-run/react";
import z from "zod";

import type { GameCreate } from "~/models/nflgame.server";
import { upsertNflGame } from "~/models/nflgame.server";
import { createNflTeams, getNflTeams } from "~/models/nflteam.server";
import type { PlayerCreate } from "~/models/players.server";
import { upsertPlayer } from "~/models/players.server";

import Alert from "~/components/ui/Alert";
import Button from "~/components/ui/Button";
import { authenticator, requireAdmin } from "~/services/auth.server";
import { graphQLClient } from "~/services/sleeperGraphql.server";
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

const sleeperGraphqlNflGames = z.object({
  scores: z.array(
    z.object({
      week: z.number(),
      status: z.string(),
      game_id: z.string(),
      metadata: z.object({
        home_team: z.string(),
        home_score: z.number().optional(),
        away_team: z.string(),
        away_score: z.number().optional(),
        date_time: z.string(),
      }),
    })
  ),
});
type SleeperGraphqlNflGames = z.infer<typeof sleeperGraphqlNflGames>;

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
    }
    case "resyncNflGames": {
      // Set up teams (this needs to be optimized to not do this)
      await createNflTeams();

      // Doing this for speed, might be able to use Prisma connect to remove this
      const sleeperTeamIdToID: Map<string, string> = new Map();
      const nflTeams = await getNflTeams();
      for (const nflTeam of nflTeams) {
        sleeperTeamIdToID.set(nflTeam.sleeperId, nflTeam.id);
      }

      const promises: Promise<SleeperGraphqlNflGames>[] = [];
      for (let i = 1; i <= 18; i++) {
        // TODO: CURRENT_YEAR needs to be used in this query
        const query = `query scores {
          scores(sport: "nfl",season_type: "regular",season: "2022",week: ${i}){
            date
            game_id
            metadata
            season
            season_type
            sport
            status
            week
          }
        }`;
        promises.push(graphQLClient.request<SleeperGraphqlNflGames>(query));
      }
      const games = (await Promise.all(promises)).flatMap(
        (result) => result.scores
      );

      const gameUpdatePromises: Promise<GameCreate>[] = [];
      for (const game of games) {
        const homeTeamId = sleeperTeamIdToID.get(game.metadata.home_team);
        const awayTeamId = sleeperTeamIdToID.get(game.metadata.away_team);

        // Doing this separate for typescript to not yell at me
        if (!homeTeamId) continue;
        if (!awayTeamId) continue;

        const gameUpsert: GameCreate = {
          sleeperGameId: game.game_id,
          status: game.status,
          gameStartTime: new Date(game.metadata.date_time),
          homeTeamId,
          homeTeamScore: game.metadata.home_score || 0,
          awayTeamId,
          awayTeamScore: game.metadata.away_score || 0,
          week: game.week,
          year: CURRENT_YEAR,
        };
        gameUpdatePromises.push(upsertNflGame(gameUpsert));
      }
      await Promise.all(gameUpdatePromises);

      return json<ActionData>({ message: "NFL Games have been updated." });
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
          <h3>Update NFL Players Database</h3>
          <p>
            This will resync all NFL players in the system. You only really need
            to do this if there's a player that's not showing up for some
            reason, or if a player gets traded. Definitely not more than once a
            day, and rarely even once a week. This command won't actually run on
            production because of memory issues, currently you need to run it on
            dev and sync the database table manually. Purging the promise table
            after every 50ish players might be a better idea.
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
