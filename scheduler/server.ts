import { scheduler } from '../app/services/scheduler.server.js';
import 'dotenv/config';

/**
 * FlexSpot FF Scheduler Service
 * Simple background service that runs scheduled jobs
 */

console.log('🕒 Starting FlexSpot FF Scheduler...');

// Graceful shutdown handling
let isShuttingDown = false;

async function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log('\n🛑 Shutting down scheduler...');

  try {
    await scheduler.stop();
    console.log('✅ Scheduler stopped gracefully');
  } catch (error) {
    console.error('❌ Error stopping scheduler:', error);
  }

  process.exit(0);
}

// Setup signal handlers
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

process.on('uncaughtException', async error => {
  console.error('💥 Uncaught Exception:', error);
  await shutdown();
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  await shutdown();
});

// Start the scheduler
async function startScheduler() {
  try {
    await scheduler.start();
    console.log('✅ Scheduler started successfully');

    const jobs = scheduler.getJobs();
    console.log('📋 Active Jobs:');
    jobs.forEach((job: any) => {
      console.log(`   • ${job.name}: ${job.cron || 'No schedule'}`);
    });

    console.log('🚀 Scheduler running in background...');
  } catch (error) {
    console.error('❌ Failed to start scheduler:', error);
    process.exit(1);
  }
}

startScheduler();
