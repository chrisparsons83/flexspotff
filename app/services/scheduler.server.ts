import Bree from 'bree';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Scheduler service using Bree for running scheduled tasks
 */
export class SchedulerService {
  private bree: Bree;

  constructor() {
    this.bree = new Bree({
      root: path.join(__dirname, '../../jobs'),
      defaultExtension: 'ts',
      jobs: [
        {
          name: 'sync-nfl-players',
          // Run every Tuesday at 2:00 AM
          cron: '0 5 * * 2',
        },
        {
          name: 'sync-leagues',
          // Run every Tuesday at 7:00 AM
          cron: '0 7 * * 2',
        },
        {
          name: 'monitor-nfl-games',
          // Run every 5 minutes
          cron: '*/5 * * * *',
        },
        // Add more jobs here as needed
      ],
      // Enable logging
      logger: console,
      // Handle job completion
      outputWorkerMetadata: true,
    });

    // Set up event handlers
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.bree.on('worker created', name => {
      console.log(`Job worker created: ${name}`);
    });

    this.bree.on('worker deleted', name => {
      console.log(`Job worker deleted: ${name}`);
    });

    this.bree.on('worker message', data => {
      console.log('Job message:', data);
    });

    this.bree.on('job completed', name => {
      console.log(`Job completed: ${name}`);
    });

    this.bree.on('job failed', (name, error) => {
      console.error(`Job failed: ${name}`, error);
    });
  }

  /**
   * Start the scheduler
   */
  async start() {
    try {
      await this.bree.start();
      console.log('Scheduler started successfully');
    } catch (error) {
      console.error('Failed to start scheduler:', error);
      throw error;
    }
  }

  /**
   * Stop the scheduler
   */
  async stop() {
    try {
      await this.bree.stop();
      console.log('Scheduler stopped successfully');
    } catch (error) {
      console.error('Failed to stop scheduler:', error);
      throw error;
    }
  }

  /**
   * Add a new job to the scheduler
   */
  addJob(jobConfig: any) {
    this.bree.add(jobConfig);
  }

  /**
   * Remove a job from the scheduler
   */
  removeJob(name: string) {
    this.bree.remove(name);
  }

  /**
   * Run a job immediately (for testing)
   */
  async runJob(name: string) {
    try {
      await this.bree.run(name);
      console.log(`Job ${name} executed manually`);
    } catch (error) {
      console.error(`Failed to run job ${name}:`, error);
      throw error;
    }
  }

  /**
   * Get job status
   */
  getJobs() {
    return this.bree.config.jobs;
  }
}

// Export a singleton instance
export const scheduler = new SchedulerService();
