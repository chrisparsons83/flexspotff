import { syncCurrentWeekScores } from '../app/libs/scoring.server.js';
import { parentPort } from 'worker_threads';

/**
 * Job to monitor NFL games and resync league and D12 scores while games are
 * live. Scheduled in app/utils/jobs.ts (every 5 minutes).
 */
async function monitorScoresJob() {
  try {
    const report = await syncCurrentWeekScores();

    if (report.d12Errors && report.d12Errors.length > 0) {
      console.error(`D12 sync had ${report.d12Errors.length} league error(s):`);
      for (const err of report.d12Errors) {
        console.error(` - ${err}`);
      }
    }

    // Send success message to parent
    if (parentPort) {
      parentPort.postMessage({ success: true, ...report });
    }
  } catch (error) {
    console.error('Score monitoring job failed:', error);

    // Send error message to parent
    if (parentPort) {
      parentPort.postMessage({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Exit with error code
    process.exit(1);
  }
}

// Run the job
monitorScoresJob();
