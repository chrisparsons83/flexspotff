import { runSideGameSyncJob } from './side-game-job.js';

/**
 * Opens each weekly side game at 8am Eastern on the Tuesday before its week's
 * first kickoff, retrying every six hours until the games are ready.
 *
 * The sync scores before it opens, so the Tuesday-morning run is also the
 * backstop for a scheduler that was down on Monday night.
 */
runSideGameSyncJob('open-side-game-weeks');
