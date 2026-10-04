import { runJob } from '../app/libs/job-runner.server.js';
import { syncCurrentWeekScores } from '../app/libs/scoring.server.js';

/**
 * Job to monitor NFL games and resync league and D12 scores while games are
 * live. Scheduled in app/utils/jobs.ts (every 5 minutes).
 */
runJob('monitor-scores', async () => {
  const report = await syncCurrentWeekScores();

  if (report.d12Errors && report.d12Errors.length > 0) {
    console.error(`D12 sync had ${report.d12Errors.length} league error(s):`);
    for (const err of report.d12Errors) {
      console.error(` - ${err}`);
    }
  }

  if (report.guillotineErrors && report.guillotineErrors.length > 0) {
    console.error(
      `Guillotine sync had ${report.guillotineErrors.length} league error(s):`,
    );
    for (const err of report.guillotineErrors) {
      console.error(` - ${err}`);
    }
  }

  if (report.bestBallErrors && report.bestBallErrors.length > 0) {
    console.error(
      `Best ball sync had ${report.bestBallErrors.length} error(s):`,
    );
    for (const err of report.bestBallErrors) {
      console.error(` - ${err}`);
    }
  }

  return report;
});
