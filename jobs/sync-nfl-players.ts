import { parentPort } from 'worker_threads';
import { syncNflPlayers } from '../app/libs/syncs.server.js';

/**
 * Job to sync NFL players database
 * Runs every Tuesday at 2:00 AM
 */
async function syncNflPlayersJob() {
  try {
    console.log('Starting NFL players sync job...');
    await syncNflPlayers();
    console.log('NFL players sync job completed successfully');
    
    // Send success message to parent
    if (parentPort) {
      parentPort.postMessage({ success: true, message: 'NFL players synced successfully' });
    }
  } catch (error) {
    console.error('NFL players sync job failed:', error);
    
    // Send error message to parent
    if (parentPort) {
      parentPort.postMessage({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
    
    // Exit with error code
    process.exit(1);
  }
}

// Run the job
syncNflPlayersJob();
