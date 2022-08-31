import z from "zod";

import type { DraftPickCreate } from "~/models/draftpick.server";
import { deleteDraftPicks } from "~/models/draftpick.server";
import { getDraftPicks } from "~/models/draftpick.server";
import { createDraftPick } from "~/models/draftpick.server";
import type { League } from "~/models/league.server";
import { updateLeague } from "~/models/league.server";
import { getPlayers } from "~/models/players.server";
import { getTeams } from "~/models/team.server";

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
