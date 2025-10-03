import { parentPort } from 'worker_threads';
import { getActiveNflGames } from '../app/models/nflgame.server.js';
import { getCurrentSeason } from '../app/models/season.server.js';
import { createNflTeams } from '../app/models/nflteam.server.js';
import { getNflState, syncNflGameWeek, syncSleeperWeeklyScores } from '../app/libs/syncs.server.js';

/**
 * Job to monitor NFL games and trigger score resyncing when games finish
 * Runs every 5 minutes during the season
 */
async function monitorNflGamesJob() {
  try {
    console.log('Starting NFL games monitoring job...');
    
    // Get current season
    const currentSeason = await getCurrentSeason();
    if (!currentSeason) {
      console.log('No current season found, skipping job');
      return;
    }

    console.log(`Monitoring NFL games for ${currentSeason.year} season...`);

    // Step 1: Check for games currently in progress before sync
    const gamesInProgressBefore = await getActiveNflGames();
    const inGameCountBefore = gamesInProgressBefore._count.id;
    
    console.log(`Games in progress before sync: ${inGameCountBefore}`);

    // Step 2: Resync NFL games for current week only
    console.log('Resyncing current week NFL games...');
    
    // Get current NFL state to determine the week
    const nflGameState = await getNflState();
    
    // Set up teams (required for sync)
    await createNflTeams();

    // Sync only the current week
    await syncNflGameWeek(
      currentSeason.year,
      [nflGameState.display_week],
    );

    console.log('NFL games sync completed');

    // Step 3: Check for games in progress after sync
    const gamesInProgressAfter = await getActiveNflGames();
    const inGameCountAfter = gamesInProgressAfter._count.id;
    
    console.log(`Games in progress after sync: ${inGameCountAfter}`);

    // Step 4: If there were games in progress before OR after sync, resync scores
    const shouldResyncScores = inGameCountBefore > 0 || inGameCountAfter > 0;
    
    if (shouldResyncScores) {
      console.log('Games detected in progress, resyncing current week scores...');
      
      // Resync scores for current week (using nflGameState from earlier)
      await syncSleeperWeeklyScores(
        currentSeason.year,
        nflGameState.display_week,
      );
      
      console.log(`Current week scores resynced for week ${nflGameState.display_week}`);
    } else {
      console.log('No games in progress detected, skipping score resync');
    }

    const message = `NFL games monitoring completed. Games before: ${inGameCountBefore}, after: ${inGameCountAfter}, scores resynced: ${shouldResyncScores}`;
    console.log(message);

    // Send success message to parent
    if (parentPort) {
      parentPort.postMessage({ 
        success: true, 
        message,
        gamesInProgressBefore: inGameCountBefore,
        gamesInProgressAfter: inGameCountAfter,
        scoresResynced: shouldResyncScores,
        season: currentSeason.year
      });
    }

  } catch (error) {
    console.error('NFL games monitoring job failed:', error);
    
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
monitorNflGamesJob();
