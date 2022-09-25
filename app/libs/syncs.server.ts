import z from "zod";

import type { DraftPickCreate } from "~/models/draftpick.server";
import { deleteDraftPicks } from "~/models/draftpick.server";
import { getDraftPicks } from "~/models/draftpick.server";
import { createDraftPick } from "~/models/draftpick.server";
import type { League } from "~/models/league.server";
import { getLeaguesByYear } from "~/models/league.server";
import { updateLeague } from "~/models/league.server";
import type { GameCreate } from "~/models/nflgame.server";
import { upsertNflGame } from "~/models/nflgame.server";
import { getNflTeams } from "~/models/nflteam.server";
import { getPlayers } from "~/models/players.server";
import { getTeams } from "~/models/team.server";
import type { TeamGame } from "~/models/teamgame.server";
import { upsertTeamGame } from "~/models/teamgame.server";
import { getTeamGamesByYearAndWeek } from "~/models/teamgame.server";

import { graphQLClient } from "~/services/sleeperGraphql.server";
import { CURRENT_YEAR } from "~/utils/constants";

const sleeperADPJson = z.array(
  z.object({
    round: z.number(),
    roster_id: z.number(),
    player_id: z.string(),
    picked_by: z.string().nullable(),
    pick_no: z.number(),
  })
);
type SleeperADPJson = z.infer<typeof sleeperADPJson>;

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

export async function syncAdp(league: League) {
  const sleeperLeagueRes = await fetch(
    `https://api.sleeper.app/v1/draft/${league.sleeperDraftId}/picks`
  );
  const sleeperJson: SleeperADPJson = sleeperADPJson.parse(
    await sleeperLeagueRes.json()
  );

  const isDrafted = sleeperJson.length === 180;

  // Delete out existing draft picks for a league
  const draftPicksQuery = await getDraftPicks(league.id);
  if (draftPicksQuery?.teams) {
    const draftPicksArray = draftPicksQuery?.teams
      .flatMap((team) => team.DraftPicks)
      .map((team) => team.id);
    await deleteDraftPicks(draftPicksArray);
  }

  // Make a map of owners to team ids
  const teams = await getTeams(league.id);
  const ownerTeamIdMap: Map<string, string> = new Map();
  for (const team of teams) {
    ownerTeamIdMap.set(team.sleeperOwnerId, team.id);
  }

  // Make a map of sleeperPlayerIds to internal ids
  const players = await getPlayers();
  const playerSleeperInternalMap: Map<string, string> = new Map();
  for (const player of players) {
    playerSleeperInternalMap.set(player.sleeperId, player.id);
  }

  const promises: Promise<DraftPickCreate>[] = [];
  for (const { pick_no, player_id, picked_by } of sleeperJson) {
    if (
      !ownerTeamIdMap.get(picked_by || "") ||
      !playerSleeperInternalMap.get(player_id || "")
    ) {
      continue;
    }
    const draftPick: DraftPickCreate = {
      pickNumber: pick_no,
      playerId: playerSleeperInternalMap.get(player_id || "")!,
      teamId: ownerTeamIdMap.get(picked_by || "")!,
    };
    promises.push(createDraftPick(draftPick));
  }
  await Promise.all(promises);

  await updateLeague({ ...league, isDrafted });

  return true;
}

export async function syncNflGameWeek(year: number, weeks: number[]) {
  // Doing this for speed, might be able to use Prisma connect to remove this
  const sleeperTeamIdToID: Map<string, string> = new Map();
  const nflTeams = await getNflTeams();
  for (const nflTeam of nflTeams) {
    sleeperTeamIdToID.set(nflTeam.sleeperId, nflTeam.id);
  }

  const promises: Promise<SleeperGraphqlNflGames>[] = [];
  for (const week of weeks) {
    const query = `query scores {
          scores(sport: "nfl",season_type: "regular",season: "${year}",week: ${week}){
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
      year,
    };
    gameUpdatePromises.push(upsertNflGame(gameUpsert));
  }
  return Promise.all(gameUpdatePromises);
}

export async function syncSleeperWeeklyScores() {
  const sleeperLeagueRes = await fetch(`https://api.sleeper.app/v1/state/nfl`);
  const sleeperJson: SleeperJsonNflState = sleeperJsonNflState.parse(
    await sleeperLeagueRes.json()
  );

  const leagues = await getLeaguesByYear(CURRENT_YEAR);
  const teams = leagues.flatMap((league) => league.teams);

  const existingTeamGames = await getTeamGamesByYearAndWeek(
    CURRENT_YEAR,
    sleeperJson.display_week
  );

  const leagueMatchupPromises: Promise<Response>[] = [];
  for (const league of leagues) {
    const url = `https://api.sleeper.app/v1/league/${league.sleeperLeagueId}/matchups/${sleeperJson.display_week}`;
    leagueMatchupPromises.push(fetch(url));
  }
  const leagueMatchupResponses = await Promise.all(leagueMatchupPromises);

  const teamGameUpserts: Promise<TeamGame>[] = [];
  for (const response of leagueMatchupResponses) {
    const sleeperLeagueId = new URL(response.url).pathname.split("/")[3];
    const matchups: SleeperJsonWeeklyMatchup = sleeperJsonWeeklyMatchup.parse(
      await response.json()
    );
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
          teamGame.teamId === team.id &&
          teamGame.week === sleeperJson.display_week
      );

      teamGameUpserts.push(
        upsertTeamGame({
          id: existingTeamGame?.id,
          sleeperMatchupId: matchup.matchup_id,
          week: sleeperJson.display_week,
          starters: matchup.starters,
          pointsScored: matchup.points,
          teamId: team.id,
        })
      );
    }
  }
  await Promise.all(teamGameUpserts);
}
