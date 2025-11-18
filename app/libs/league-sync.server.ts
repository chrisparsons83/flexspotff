import { DateTime } from 'luxon';
import { env } from 'process';
import { syncAdp } from './syncs.server';
import { updateLeague, type League } from '~/models/league.server';
import { createTeam, getTeams, updateTeam } from '~/models/team.server';
import { getUsers } from '~/models/user.server';
import { SLEEPER_ADMIN_ID } from '~/utils/constants';
import { sleeperTeamJson, sleeperDraftJson, type SleeperTeamJson, type SleeperDraftJson } from '~/utils/types';

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
  const existingTeamsSleeperOwners = (await getTeams(league.id)).map(
    team => [team.sleeperOwnerId, team.id],
  );

  // Get users once for this sync operation
  const existingUsersSleeperIds = (await getUsers()).flatMap(
    ({ id, sleeperUsers }) =>
      sleeperUsers.map(sleeperUser => ({
        id,
        sleeperOwnerID: sleeperUser.sleeperOwnerID,
      })),
  );

  // Update league draft date if available
  if (sleeperDraft.start_time) {
    const updatedLeague = {
      ...league,
      draftDateTime: DateTime.fromSeconds(
        sleeperDraft.start_time / 1000,
      ).toJSDate(),
    };
    await updateLeague(updatedLeague);
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push({ leagueName: league.name, error: errorMessage });
      console.error(`❌ Failed to sync league ${league.name}:`, error);
    }
  }

  return { syncedCount, errorCount, errors };
}
