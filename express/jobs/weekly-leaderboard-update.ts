import { parentPort } from "node:worker_threads";

// import { syncSleeperWeeklyScores } from "~/libs/syncs.server";

(async () => {
  if (parentPort) {
    // await syncSleeperWeeklyScores();
    parentPort.postMessage("Scores loaded");
  } else process.exit(0);
})();
