import { syncActiveGuillotineLeagues } from '../app/libs/guillotine/sync.server.js';
import { getCurrentSeason } from '../app/models/season.server.js';
import { parentPort } from 'worker_threads';

/**
 * Keeps this season's guillotine leagues current between games. The live score
 * monitor only syncs while games are on, but a chop lands on Tuesday and the
 * waiver run early Wednesday, so this picks them up within the hour. Scheduled
 * in app/utils/jobs.ts.
 */
async function syncGuillotineJob() {
  try {
    const season = await getCurrentSeason();
    if (!season) {
      console.log('No current season, skipping guillotine sync');
      if (parentPort)
        parentPort.postMessage({ success: true, message: 'No current season' });
      return;
    }

    const errors = await syncActiveGuillotineLeagues(season.year);
    for (const err of errors) {
      console.error(` - ${err}`);
    }

    const message = `Guillotine leagues synced for ${season.year}`;
    console.log(message);
    if (parentPort) parentPort.postMessage({ success: true, message, errors });
  } catch (error) {
    console.error('Guillotine sync job failed:', error);
    if (parentPort) {
      parentPort.postMessage({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
    process.exit(1);
  }
}

syncGuillotineJob();
