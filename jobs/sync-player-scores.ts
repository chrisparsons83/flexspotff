import { syncPlayerWeekScores } from '../app/libs/dfs-survivor/player-week-scores.server.js';
import { DFS_SURVIVOR_LAST_WEEK } from '../app/libs/dfs-survivor/slots.js';
import { runJob } from '../app/libs/job-runner.server.js';
import { getCurrentNflWeek } from '../app/models/nflgame.server.js';
import { getCurrentSeason } from '../app/models/season.server.js';

/**
 * Job to keep every player's DFS Survivor points and Sleeper projections fresh,
 * which is what the DFS Survivor entry picker sorts on.
 *
 * Scheduled in app/utils/jobs.ts (hourly). Refreshes the previous week - late
 * Sleeper stat corrections land days after a game - the current week, and
 * projections for the next. It used to rewrite every week since week 1 each
 * hour, a load that grew all season; older weeks can still be backfilled with
 * Sync Player Scores on the DFS Survivor admin page.
 */
runJob('sync-player-scores', async () => {
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
  const from = Math.max(currentWeek - 1, 1);
  const through = Math.min(currentWeek + 1, DFS_SURVIVOR_LAST_WEEK);
  const weeksSynced: number[] = [];
  for (let week = from; week <= through; week++) {
    const result = await syncPlayerWeekScores(currentSeason.year, week);
    weeksSynced.push(week);
    console.log(`Week ${week}: wrote ${result.playersWritten} player scores.`);
  }

  console.log('Player week scores sync job completed successfully');

  return { year: currentSeason.year, weeksSynced };
});
