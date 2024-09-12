import { parentPort } from 'node:worker_threads';

import { syncNflPlayers } from '~/libs/syncs.server';

(async () => {
  if (parentPort) {
    await syncNflPlayers();
  } else process.exit(0);
})();
