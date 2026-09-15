import Bree from 'bree';
import path from 'path';
import { SCHEDULED_JOBS } from '~/utils/jobs';

/**
 * Scheduler service using Bree for running scheduled tasks
 */
export class SchedulerService {
  private bree: Bree;

  constructor() {
    const isProduction = process.env.NODE_ENV === 'production';
    const jobsRoot = isProduction
      ? path.join(process.cwd(), 'build/jobs')
      : path.join(process.cwd(), 'jobs');
    const jobExtension = isProduction ? 'cjs' : 'ts';

    console.log(`Scheduler Environment: ${process.env.NODE_ENV}`);
    console.log(`Jobs Root: ${jobsRoot}`);
    console.log(`Job Extension: ${jobExtension}`);

    this.bree = new Bree({
      root: jobsRoot,
      defaultExtension: jobExtension,
      // Spread the timezone conditionally: Bree rejects an explicit undefined.
      jobs: SCHEDULED_JOBS.map(({ name, cron, timezone }) => ({
        name,
        cron,
        ...(timezone ? { timezone } : {}),
      })),
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
}

let instance: SchedulerService | undefined;

/**
 * Built on first use rather than at import time. The admin scheduler page
 * imports this module, and a module-scope instance meant the Remix server spun
 * up its own second Bree alongside the scheduler process's - and inherited its
 * startup failures, since Bree resolves every job path eagerly.
 */
export function getScheduler() {
  if (!instance) {
    instance = new SchedulerService();
  }
  return instance;
}
