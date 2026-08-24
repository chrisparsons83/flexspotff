import { syncAdp } from './syncs.server';
import { DateTime } from 'luxon';
import { env } from 'process';
import { updateLeague, type League } from '~/models/league.server';
import { createTeam, getTeams, updateTeam } from '~/models/team.server';
import { getUsersIncludingMerged } from '~/models/user.server';
import { SLEEPER_ADMIN_ID } from '~/utils/constants';
import {
  sleeperTeamJson,
  sleeperDraftJson,
  sleeperLeagueUsersJson,
  type SleeperTeamJson,
  type SleeperDraftJson,
  type SleeperLeagueUsersJson,
} from '~/utils/types';

/**
 * Syncs a single league with Sleeper API data
 * @param league - The league to sync
 * @returns Promise that resolves when sync is complete
 */
export async function syncLeague(league: League): Promise<void> {
  // Fetch data from Sleeper API
  const teamsUrl = `https://api.sleeper.app/v1/league/${league.sleeperLeagueId}/rosters`;
  const draftsUrl = `https://api.sleeper.app/v1/draft/${league.sleeperDraftId}`;

  const [sleeperTeamsRes, sleeperDraftRes] = await Promise.all([
    fetch(teamsUrl),
    fetch(draftsUrl),
  ]);

  if (!sleeperTeamsRes.ok || !sleeperDraftRes.ok) {
    throw new Error(`API request failed for league ${league.name}`);
  }

  const sleeperTeams: SleeperTeamJson = sleeperTeamJson
    .parse(await sleeperTeamsRes.json())
    .map(team => ({
      ...team,
      owner_id: team.owner_id
        ? team.owner_id
        : team.league_id === '335507311525122048'
        ? // Ice did something stupid with his team in Champs this year so this fixes that
          '76491376673832960'
        : SLEEPER_ADMIN_ID,
    }));

  const sleeperDraft: SleeperDraftJson = sleeperDraftJson.parse(
    await sleeperDraftRes.json(),
  );

  // Get existing teams for this league
  const existingTeamsSleeperOwners = (await getTeams(league.id)).map(team => [
    team.sleeperOwnerId,
    team.id,
  ]);

  // Get users once for this sync operation
  // Merged members are included and resolved to whoever absorbed them. Leaving
  // them out instead would make a Sleeper link that still points at one fail to
  // resolve, and the team below would be saved with userId: null - which drops
  // those seasons out of the record book, since getCareerRecords skips them.
  const existingUsersSleeperIds = (await getUsersIncludingMerged()).flatMap(
    ({ id, mergedInto, sleeperUsers }) =>
      sleeperUsers.map(sleeperUser => ({
        id: mergedInto?.id ?? id,
        sleeperOwnerID: sleeperUser.sleeperOwnerID,
      })),
  );

  // Update league draft date if available. start_time is epoch milliseconds.
  if (sleeperDraft.start_time) {
    await updateLeague({
      id: league.id,
      draftDateTime: DateTime.fromSeconds(
        sleeperDraft.start_time / 1000,
      ).toJSDate(),
    });
  }

  // Clean up legacy league names (2018 cleanup)
  if (league.name.match(/^FFDC - /)) {
    await updateLeague({
      id: league.id,
      name: league.name.replace(/^FFDC - /, ''),
    });
  }

  // Sync teams
  const teamPromises = [];
  for (const sleeperTeam of sleeperTeams) {
    // Skip admin teams
    if (
      !sleeperTeam.owner_id ||
      sleeperTeam.owner_id === env.FFDISCORDADMIN_SLEEPER_ID
    ) {
      continue;
    }

    // Build team object
    const systemUser = existingUsersSleeperIds.filter(
      user => user.sleeperOwnerID === sleeperTeam.owner_id,
    );

    // Parse median record from metadata.record string
    // Each week has 2 characters: first is H2H result, second is median result
    const recordString = sleeperTeam.metadata?.record || '';
    let medianWins = 0;
    let medianTies = 0;
    let medianLosses = 0;

    for (let i = 1; i < recordString.length; i += 2) {
      const medianResult = recordString[i];
      if (medianResult === 'W') medianWins++;
      else if (medianResult === 'T') medianTies++;
      else if (medianResult === 'L') medianLosses++;
    }

    const team = {
      wins: sleeperTeam.settings.wins,
      losses: sleeperTeam.settings.losses,
      ties: sleeperTeam.settings.ties,
      medianWins,
      medianTies,
      medianLosses,
      sleeperOwnerId: sleeperTeam.owner_id!,
      pointsFor:
        (sleeperTeam.settings.fpts ?? 0) +
        0.01 * (sleeperTeam.settings.fpts_decimal ?? 0),
      pointsAgainst:
        (sleeperTeam.settings.fpts_against ?? 0) +
        0.01 * (sleeperTeam.settings.fpts_against_decimal ?? 0),
      rosterId: sleeperTeam.roster_id,
      leagueId: league.id,
      draftPosition: sleeperDraft.draft_order
        ? sleeperDraft.draft_order[sleeperTeam.owner_id]
        : null,
      userId: systemUser.length > 0 ? systemUser[0].id : null,
    };

    // Update existing team or create new one
    const existingTeam = existingTeamsSleeperOwners.filter(
      team => team[0] === sleeperTeam.owner_id,
    );

    if (existingTeam.length > 0) {
      teamPromises.push(updateTeam({ id: existingTeam[0][1], ...team }));
    } else {
      teamPromises.push(createTeam(team));
    }
  }

  await Promise.all(teamPromises);

  // Sync ADP if league hasn't drafted yet
  if (!league.isDrafted) {
    await syncAdp(league);
  }
}

/**
 * Syncs multiple leagues with error handling
 * @param leagues - Array of leagues to sync
 * @returns Object with sync results
 */
export async function syncMultipleLeagues(leagues: League[]): Promise<{
  syncedCount: number;
  errorCount: number;
  errors: Array<{ leagueName: string; error: string }>;
}> {
  let syncedCount = 0;
  let errorCount = 0;
  const errors: Array<{ leagueName: string; error: string }> = [];

  for (const league of leagues) {
    try {
      await syncLeague(league);
      syncedCount++;
      console.log(`✅ Successfully synced league: ${league.name}`);
    } catch (error) {
      errorCount++;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      errors.push({ leagueName: league.name, error: errorMessage });
      console.error(`❌ Failed to sync league ${league.name}:`, error);
    }
  }

  return { syncedCount, errorCount, errors };
}

export type SleeperLeagueUser = {
  sleeperOwnerId: string;
  username: string | null;
  displayName: string | null;
  teamName: string | null;
};

/**
 * Looks up the display names behind the Sleeper owner IDs in a league. Teams
 * only ever store the owner ID, so this is the only way to put a human-readable
 * name next to an unmatched team.
 * @param sleeperLeagueId - The Sleeper league ID to look up
 * @returns The league's Sleeper users keyed by owner ID
 */
export async function getSleeperLeagueUsers(
  sleeperLeagueId: League['sleeperLeagueId'],
): Promise<Map<string, SleeperLeagueUser>> {
  const res = await fetch(
    `https://api.sleeper.app/v1/league/${sleeperLeagueId}/users`,
  );

  if (!res.ok) {
    throw new Error(
      `Sleeper user lookup failed for league ${sleeperLeagueId} (${res.status})`,
    );
  }

  // Sleeper answers 200 with a null body for a league ID it doesn't know, so a
  // bad ID lands here rather than above. Parse it by hand: a raw ZodError
  // message is a JSON blob, and this one goes in front of an admin.
  const parsedUsers = sleeperLeagueUsersJson.safeParse(await res.json());
  if (!parsedUsers.success) {
    throw new Error(
      `Sleeper returned no usable user list for league ${sleeperLeagueId}`,
    );
  }
  const sleeperUsers: SleeperLeagueUsersJson = parsedUsers.data;

  return new Map(
    sleeperUsers.map(sleeperUser => [
      sleeperUser.user_id,
      {
        sleeperOwnerId: sleeperUser.user_id,
        username: sleeperUser.username ?? null,
        displayName: sleeperUser.display_name ?? null,
        teamName: sleeperUser.metadata?.team_name ?? null,
      },
    ]),
  );
}
