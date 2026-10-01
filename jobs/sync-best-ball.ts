import { syncActiveBestBallLeagues } from '../app/libs/best-ball/sync.server.js';
import { getCurrentSeason } from '../app/models/season.server.js';
import { parentPort } from 'worker_threads';

/**
 * Keeps this season's best ball league current between games, picking up the
 * stat corrections Sleeper applies after a week ends. The live score monitor
 * covers it while games are on. Scheduled in app/utils/jobs.ts.
 */
async function syncBestBallJob() {
  try {
    const season = await getCurrentSeason();
    if (!season) {
      console.log('No current season, skipping best ball sync');
      if (parentPort)
        parentPort.postMessage({ success: true, message: 'No current season' });
      return;
    }

    const errors = await syncActiveBestBallLeagues(season.year);
    for (const err of errors) {
      console.error(` - ${err}`);
    }

    const message = `Best ball league synced for ${season.year}`;
    console.log(message);
    if (parentPort) parentPort.postMessage({ success: true, message, errors });
  } catch (error) {
    console.error('Best ball sync job failed:', error);
    if (parentPort) {
      parentPort.postMessage({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
    process.exit(1);
  }
}

syncBestBallJob();
