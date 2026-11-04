import { runJob } from '../app/libs/job-runner.server.js';
import { syncQbStreaming } from '../app/libs/qb-streaming/sync.server.js';

/**
 * Opens this week's QB Streaming on Wednesday morning and keeps its QB list
 * current. Scheduled in app/utils/jobs.ts.
 */
runJob('sync-qb-streaming', async () => {
  const { message, alertError } = await syncQbStreaming();
  console.log(message);

  // The week itself is written either way; this only flags that #admin-alerts
  // didn't hear about it.
  if (alertError) {
    return {
      success: false,
      message: `${message}, but the admin alert failed: ${alertError}`,
    };
  }
  return { message };
});
