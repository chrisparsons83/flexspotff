import {
  getNflState,
  syncNflGameWeek,
  syncSleeperWeeklyScores,
} from '../app/libs/syncs.server.js';
import { getActiveNflGames } from '../app/models/nflgame.server.js';
import { createNflTeams } from '../app/models/nflteam.server.js';
import { getCurrentSeason } from '../app/models/season.server.js';
import { parentPort } from 'worker_threads';

/**
 * Job to monitor NFL games and trigger score resyncing when games finish
 * Runs every 5 minutes during the season
 */
async function monitorNflGamesJob() {
  try {
    // Get current season
    const currentSeason = await getCurrentSeason();
    if (!currentSeason) {
      console.log('No current season found, skipping job');
      return;
    }

    // Step 1: Check for games currently in progress before sync
    const gamesInProgressBefore = await getActiveNflGames();
    const inGameCountBefore = gamesInProgressBefore._count.id;

    // Get current NFL state to determine the week
    const nflGameState = await getNflState();

    // Set up teams (required for sync)
    await createNflTeams();

    // Sync only the current week
    await syncNflGameWeek(currentSeason.year, [nflGameState.display_week]);

    // Step 3: Check for games in progress after sync
    const gamesInProgressAfter = await getActiveNflGames();
    const inGameCountAfter = gamesInProgressAfter._count.id;

    // Step 4: If there were games in progress before OR after sync, resync scores
    const shouldResyncScores = inGameCountBefore > 0 || inGameCountAfter > 0;

    if (shouldResyncScores) {
      // Resync scores for current week (using nflGameState from earlier)
      await syncSleeperWeeklyScores(
        currentSeason.year,
        nflGameState.display_week,
      );
    }

    const message = `NFL games monitoring completed. Games before: ${inGameCountBefore}, after: ${inGameCountAfter}`;

    // Send success message to parent
    if (parentPort) {
      parentPort.postMessage({
        success: true,
        message,
        gamesInProgressBefore: inGameCountBefore,
        gamesInProgressAfter: inGameCountAfter,
        scoresResynced: shouldResyncScores,
        season: currentSeason.year,
      });
    }
  } catch (error) {
    console.error('NFL games monitoring job failed:', error);

    // Send error message to parent
    if (parentPort) {
      parentPort.postMessage({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Exit with error code
    process.exit(1);
  }
}

// Run the job
monitorNflGamesJob();
