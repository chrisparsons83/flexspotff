import { syncMultipleLeagueBrackets } from '../app/libs/bracket-sync.server.js';
import { runJob } from '../app/libs/job-runner.server.js';
import { syncMultipleLeagues } from '../app/libs/league-sync.server.js';
import { getLeaguesByYear } from '../app/models/league.server.js';
import { getCurrentSeason } from '../app/models/season.server.js';

/**
 * Job to sync all leagues in the current season
 * Scheduled in app/utils/jobs.ts (Tuesdays at 07:00 UTC).
 */
runJob('sync-leagues', async () => {
  console.log('Starting leagues sync job...');

  // Get current season
  const currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    throw new Error('No current season found');
  }

  console.log(`Syncing leagues for ${currentSeason.year} season...`);

  // Get all leagues for current season
  const leagues = await getLeaguesByYear(currentSeason.year);
  console.log(`Found ${leagues.length} leagues to sync`);

  // Sync all leagues using shared function
  const { syncedCount, errorCount, errors } = await syncMultipleLeagues(
    leagues,
  );

  // Brackets are synced after the rosters so roster ids resolve to teams that
  // definitely exist. Until the regular season is over every league is
  // skipped.
  const brackets = await syncMultipleLeagueBrackets(leagues);
  console.log(
    `Playoff brackets: ${brackets.gamesStored} games across ${brackets.syncedCount} leagues, ${brackets.skippedCount} skipped (regular season still running), ${brackets.errorCount} failed`,
  );

  const message = `Leagues sync completed: ${syncedCount} successful, ${errorCount} failed`;
  console.log(message);

  if (errors.length > 0) {
    console.log('Errors encountered:');
    errors.forEach(({ leagueName, error }) => {
      console.log(`  - ${leagueName}: ${error}`);
    });
  }

  return {
    message,
    syncedCount,
    errorCount,
    totalLeagues: leagues.length,
    errors,
  };
});
