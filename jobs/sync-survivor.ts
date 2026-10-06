import { runJob } from '../app/libs/job-runner.server.js';
import { syncActiveSurvivorPools } from '../app/libs/survivor/sync.server.js';
import { getCurrentSeason } from '../app/models/season.server.js';

/**
 * Keeps this season's Sleeper survivor pools current. Scheduled in
 * app/utils/jobs.ts.
 */
runJob('sync-survivor', async () => {
  const season = await getCurrentSeason();
  if (!season) {
    console.log('No current season, skipping survivor sync');
    return { message: 'No current season' };
  }

  const errors = await syncActiveSurvivorPools(season.year);
  for (const err of errors) {
    console.error(` - ${err}`);
  }

  const message = `Survivor pools synced for ${season.year}`;
  console.log(message);
  return { message, errors };
});
