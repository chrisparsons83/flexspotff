import { runJob } from '../app/libs/job-runner.server.js';
import { syncSideGameWeeks } from '../app/libs/side-games/sync.server.js';

/**
 * Scores the weekly side games once every game of their week is complete.
 * Scheduled in app/utils/jobs.ts for Monday evening Pacific, when the last
 * kickoff has happened and the final whistle is close.
 */
runJob('score-side-game-weeks', async () => {
  const { message, errors } = await syncSideGameWeeks(new Date());
  console.log(message);

  // A week that could not be scored is worth failing the run over so the
  // scheduler page shows it. An alert that failed to post is only a warning:
  // the score itself was already written.
  if (errors.length > 0) {
    return {
      success: false,
      message: `${message}: ${errors.join('; ')}`,
    };
  }
  return { message };
});
