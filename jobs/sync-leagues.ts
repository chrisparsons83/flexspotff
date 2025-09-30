import { parentPort } from 'worker_threads';
import { syncMultipleLeagues } from '../app/libs/league-sync.server.js';
import { getLeaguesByYear } from '../app/models/league.server.js';
import { getCurrentSeason } from '../app/models/season.server.js';

/**
 * Job to sync all leagues in the current season
 * Runs every Tuesday at 7:00 AM
 */
async function syncLeaguesJob() {
  try {
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
    const { syncedCount, errorCount, errors } = await syncMultipleLeagues(leagues);

    const message = `Leagues sync completed: ${syncedCount} successful, ${errorCount} failed`;
    console.log(message);

    if (errors.length > 0) {
      console.log('Errors encountered:');
      errors.forEach(({ leagueName, error }) => {
        console.log(`  - ${leagueName}: ${error}`);
      });
    }

    // Send success message to parent
    if (parentPort) {
      parentPort.postMessage({ 
        success: true, 
        message,
        syncedCount,
        errorCount,
        totalLeagues: leagues.length,
        errors
      });
    }

  } catch (error) {
    console.error('Leagues sync job failed:', error);
    
    // Send error message to parent
    if (parentPort) {
      parentPort.postMessage({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
    
    // Exit with error code
    process.exit(1);
  }
}

// Run the job
syncLeaguesJob();
