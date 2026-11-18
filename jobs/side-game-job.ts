import { runJob } from '../app/libs/job-runner.server.js';
import { syncSideGameWeeks } from '../app/libs/side-games/sync.server.js';

/**
 * The shared body of both side-game jobs.
 *
 * They differ only in cadence, so one helper keeps their reporting identical.
 * The report's warnings (a failed admin alert, a failed DFS player-score
 * refresh) must reach the scheduler's message: those writes already landed, so
 * they do not fail the run, but they must not be silent either. Only a report
 * error fails the run.
 */
export function runSideGameSyncJob(name: string) {
  return runJob(name, async () => {
    const { message, warnings, errors } = await syncSideGameWeeks(new Date());

    const warningSummary =
      warnings.length > 0 ? `; warnings: ${warnings.join('; ')}` : '';
    const errorSummary =
      errors.length > 0 ? `; errors: ${errors.join('; ')}` : '';
    const summary = `${message}${warningSummary}${errorSummary}`;
    console.log(summary);

    // A week that could not be opened or scored is worth failing the run over
    // so the scheduler page shows it. Alert and refresh failures are warnings:
    // the week itself was already written.
    if (errors.length > 0) {
      return { success: false, message: summary };
    }
    return { message: summary };
  });
}
