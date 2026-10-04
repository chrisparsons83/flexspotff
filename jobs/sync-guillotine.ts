import { syncActiveGuillotineLeagues } from '../app/libs/guillotine/sync.server.js';
import { runJob } from '../app/libs/job-runner.server.js';
import { getCurrentSeason } from '../app/models/season.server.js';

/**
 * Keeps this season's guillotine leagues current between games. The live score
 * monitor only syncs while games are on, but a chop lands Monday night or
 * Tuesday and the waiver run just after midnight Thursday (Pacific), so this
 * picks them up within the hour. Scheduled in app/utils/jobs.ts.
 */
runJob('sync-guillotine', async () => {
  const season = await getCurrentSeason();
  if (!season) {
    console.log('No current season, skipping guillotine sync');
    return { message: 'No current season' };
  }

  const errors = await syncActiveGuillotineLeagues(season.year);
  for (const err of errors) {
    console.error(` - ${err}`);
  }

  const message = `Guillotine leagues synced for ${season.year}`;
  console.log(message);
  return { message, errors };
});
