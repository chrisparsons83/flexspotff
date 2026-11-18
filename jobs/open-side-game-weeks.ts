import { runJob } from '../app/libs/job-runner.server.js';
import { syncSideGameWeeks } from '../app/libs/side-games/sync.server.js';

/**
 * Opens each weekly side game at 8am Eastern on the Tuesday before its week's
 * first kickoff, retrying every six hours until the slate is ready.
 *
 * The sync scores before it opens, so the Tuesday-morning run is also the
 * backstop for a scheduler that was down on Monday night.
 */
runJob('open-side-game-weeks', async () => {
  const { message, errors } = await syncSideGameWeeks(new Date());
  console.log(message);

  // A week that could not be opened is worth failing the run over so the
  // scheduler page shows it. An alert that failed to post is only a warning:
  // the week itself was already opened.
  if (errors.length > 0) {
    return {
      success: false,
      message: `${message}: ${errors.join('; ')}`,
    };
  }
  return { message };
});
