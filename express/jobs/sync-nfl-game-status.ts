import { parentPort } from "node:worker_threads";

import { getNflState, syncNflGameWeek } from "~/libs/syncs.server";
import { CURRENT_YEAR } from "~/utils/constants";

(async () => {
  if (parentPort) {
    const nflState = await getNflState();
    await syncNflGameWeek(CURRENT_YEAR, [nflState.display_week]);
    parentPort.postMessage(
      `${CURRENT_YEAR} NFL Week ${nflState.display_week} games updated`
    );
  } else process.exit(0);
})();
