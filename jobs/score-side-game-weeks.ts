import { runSideGameSyncJob } from './side-game-job.js';

/**
 * Scores the weekly side games once every game of their week is complete.
 * Scheduled in app/utils/jobs.ts for Monday evening Pacific, when the last
 * kickoff has happened and the final whistle is close.
 */
runSideGameSyncJob('score-side-game-weeks');
