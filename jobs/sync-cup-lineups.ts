import { syncPlannedCupLineups } from '../app/libs/cup/planned-lineups.server.js';
import { runJob } from '../app/libs/job-runner.server.js';
import { getCurrentSeason } from '../app/models/season.server.js';

/**
 * Job to keep each team's lineup for upcoming cup weeks fresh, which is what
 * the bracket projects those weeks from. Scheduled in app/utils/jobs.ts.
 */
runJob('sync-cup-lineups', async () => {
  const currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    throw new Error('No active season currently');
  }

  const result = await syncPlannedCupLineups(currentSeason.year);
  console.log(
    `Weeks ${result.weeks.join(', ') || 'none'}: stored ${
      result.lineups
    } lineups, ${result.optimal} of them optimal.`,
  );

  return { year: currentSeason.year, ...result };
});
