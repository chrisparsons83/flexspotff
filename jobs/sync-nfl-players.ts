import { runJob } from '../app/libs/job-runner.server.js';
import { syncNflPlayers } from '../app/libs/syncs.server.js';

/**
 * Job to sync NFL players database
 * Scheduled in app/utils/jobs.ts (Tuesdays at 05:00 UTC).
 */
runJob('sync-nfl-players', async () => {
  console.log('Starting NFL players sync job...');
  await syncNflPlayers();
  console.log('NFL players sync job completed successfully');

  return { message: 'NFL players synced successfully' };
});
