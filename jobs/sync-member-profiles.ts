import { syncMemberProfiles } from '../app/libs/discord-members.server.js';
import { parentPort } from 'worker_threads';

async function syncMemberProfilesJob() {
  try {
    console.log('Starting member profile sync...');

    const result = await syncMemberProfiles();

    for (const rename of result.renamed) {
      console.log(`Renamed ${rename.userId}: ${rename.from} -> ${rename.to}`);
    }

    const message = `Checked ${result.checked} members: ${result.updated} updated, ${result.notInServer} not in the server`;
    console.log(message);

    if (parentPort) {
      parentPort.postMessage({ success: true, message, result });
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
