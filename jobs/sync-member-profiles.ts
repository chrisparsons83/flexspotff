import { syncMemberProfiles } from '../app/libs/discord-members.server.js';
import { parentPort } from 'worker_threads';

async function syncMemberProfilesJob() {
  try {
    console.log('Starting member profile sync...');

    const result = await syncMemberProfiles();

    for (const rename of result.renamed) {
      console.log(`Renamed ${rename.userId}: ${rename.from} -> ${rename.to}`);
    }

    const message = `Checked ${result.checked} members: ${result.updated} updated, ${result.notInServer} not in the server, ${result.failed.length} failed`;
    console.log(message);

    if (parentPort) {
      parentPort.postMessage({
        success: result.failed.length === 0,
        message,
        result,
      });
    }

    // Everyone else was still synced, but a failure should show on the
    // scheduler rather than pass as a clean run.
    if (result.failed.length > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Member profile sync failed:', error);
    if (parentPort) {
      parentPort.postMessage({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
    process.exit(1);
  }
}

syncMemberProfilesJob();
