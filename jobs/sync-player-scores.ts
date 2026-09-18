import { syncPlayerWeekScores } from '../app/libs/dfs-survivor/player-week-scores.server.js';
import { DFS_SURVIVOR_LAST_WEEK } from '../app/libs/dfs-survivor/slots.js';
import { getCurrentNflWeek } from '../app/models/nflgame.server.js';
import { getCurrentSeason } from '../app/models/season.server.js';
import { parentPort } from 'worker_threads';

/**
 * Job to keep every player's DFS Survivor points and Sleeper projections fresh,
 * which is what the DFS Survivor entry picker sorts on.
 *
 * Scheduled in app/utils/jobs.ts (hourly). Refreshes actual stats for weeks 1
 * through the current week - late Sleeper stat corrections land days after a
 * game - and projections for the current and next week.
 */
async function syncPlayerScoresJob() {
  try {
    console.log('Starting player week scores sync job...');

    const currentSeason = await getCurrentSeason();
    if (!currentSeason) {
      throw new Error('No active season currently');
    }

    const currentWeek = await getCurrentNflWeek(currentSeason.year, new Date());
    if (!currentWeek) {
      throw new Error(`No NFL schedule stored for ${currentSeason.year}`);
    }

    // One week past the current one so next week's projections are ready to
    // pick against, but never past the last DFS Survivor week - Sleeper has no
    // such week and the error would take the whole job down.
    const through = Math.min(currentWeek + 1, DFS_SURVIVOR_LAST_WEEK);
    const weeksSynced: number[] = [];
    for (let week = 1; week <= through; week++) {
      const result = await syncPlayerWeekScores(currentSeason.year, week);
      weeksSynced.push(week);
      console.log(
        `Week ${week}: wrote ${result.playersWritten} player scores.`,
      );
    }

    console.log('Player week scores sync job completed successfully');

    if (parentPort) {
      parentPort.postMessage({
        success: true,
        year: currentSeason.year,
        weeksSynced,
      });
    }
  } catch (error) {
    console.error('Player week scores sync job failed:', error);

    if (parentPort) {
      parentPort.postMessage({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    process.exit(1);
  }
}

// Run the job
syncPlayerScoresJob();
