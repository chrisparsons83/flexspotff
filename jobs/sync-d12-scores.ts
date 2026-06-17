import { syncD12Season } from '../app/libs/d12-sync.server.js';
import { getLatestD12Season } from '../app/models/d12season.server.js';
import { parentPort } from 'worker_threads';

async function syncD12ScoresJob() {
  try {
    console.log('Starting D12 scores sync job...');

    const season = await getLatestD12Season();
    if (!season) {
      console.log('No D12 season found, skipping sync');
      if (parentPort)
        parentPort.postMessage({
          success: true,
          message: 'No D12 season found',
        });
      return;
    }

    console.log(`Syncing D12 scores for ${season.year}...`);
    await syncD12Season(season.year);

    const message = `D12 scores sync completed for ${season.year}`;
    console.log(message);

    if (parentPort) {
      parentPort.postMessage({ success: true, message });
    }
  } catch (error) {
    console.error('D12 scores sync job failed:', error);
    if (parentPort) {
      parentPort.postMessage({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
    process.exit(1);
  }
}

syncD12ScoresJob();
