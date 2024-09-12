import { parentPort } from 'node:worker_threads';

import { getNflState, syncNflGameWeek } from '~/libs/syncs.server';

// TODO: Make this not hardcoded to 2023.
(async () => {
  if (parentPort) {
    const nflState = await getNflState();
    await syncNflGameWeek(2023, [nflState.display_week]);
    parentPort.postMessage(
      `${2023} NFL Week ${nflState.display_week} games updated`,
    );
  } else process.exit(0);
})();
