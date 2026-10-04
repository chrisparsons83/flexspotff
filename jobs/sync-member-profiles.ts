import { syncMemberProfiles } from '../app/libs/discord-members.server.js';
import { runJob } from '../app/libs/job-runner.server.js';

runJob('sync-member-profiles', async () => {
  console.log('Starting member profile sync...');

  const result = await syncMemberProfiles();

  for (const rename of result.renamed) {
    console.log(`Renamed ${rename.userId}: ${rename.from} -> ${rename.to}`);
  }

  const message = `Checked ${result.checked} members: ${result.updated} updated, ${result.notInServer} not in the server, ${result.failed.length} failed`;
  console.log(message);

  // Everyone else was still synced, but a failure should show on the
  // scheduler rather than pass as a clean run.
  return { success: result.failed.length === 0, message, result };
});
