import { syncD12Season } from '../app/libs/d12-sync.server.js';
import { runJob } from '../app/libs/job-runner.server.js';
import { getLatestD12Season } from '../app/models/d12season.server.js';

runJob('sync-d12-scores', async () => {
  console.log('Starting D12 scores sync job...');

  const season = await getLatestD12Season();
  if (!season) {
    console.log('No D12 season found, skipping sync');
    return { message: 'No D12 season found' };
  }

  console.log(`Syncing D12 scores for ${season.year}...`);
  const errors = await syncD12Season(season.year);

  if (errors.length > 0) {
    console.error(`D12 sync completed with ${errors.length} league error(s):`);
    for (const err of errors) {
      console.error(` - ${err}`);
    }
  }

  const message = `D12 scores sync completed for ${season.year}`;
  console.log(message);
  return { message, errors };
});
