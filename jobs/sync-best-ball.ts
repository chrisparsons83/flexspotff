import { syncActiveBestBallLeagues } from '../app/libs/best-ball/sync.server.js';
import { runJob } from '../app/libs/job-runner.server.js';
import { getCurrentSeason } from '../app/models/season.server.js';

/**
 * Keeps this season's best ball league current between games, picking up the
 * stat corrections Sleeper applies after a week ends. The live score monitor
 * covers it while games are on. Scheduled in app/utils/jobs.ts.
 */
runJob('sync-best-ball', async () => {
  const season = await getCurrentSeason();
  if (!season) {
    console.log('No current season, skipping best ball sync');
    return { message: 'No current season' };
  }

  const errors = await syncActiveBestBallLeagues(season.year);
  for (const err of errors) {
    console.error(` - ${err}`);
  }

  const message = `Best ball league synced for ${season.year}`;
  console.log(message);
  return { message, errors };
});
