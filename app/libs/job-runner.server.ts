import { parentPort, workerData } from 'worker_threads';
import { prisma } from '~/db.server';

/**
 * What a job body hands back. Everything here is posted to the scheduler as the
 * job's message; `success: false` marks a run that finished but should still
 * show as failed (e.g. some members could not be synced).
 */
export type JobResult = {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
};

/**
 * Runs a scheduled job's body inside its Bree worker thread.
 *
 * Every job goes through here so a failure ends the worker the same safe way.
 * Jobs used to call `process.exit(1)` on failure. Inside a worker thread, with
 * Prisma's native query engine still running queries the failed job had in
 * flight, that aborted the entire scheduler process (a pthread mutex assertion
 * and a core dump), so a single failed hourly job silently stopped live scoring
 * for days. Instead, the worker reports the failure, disconnects Prisma, sets
 * a failing exit code and is left to wind down on its own.
 *
 * Each run is also recorded in `ScheduledJobRun`, so the admin scheduler page
 * can show when a job last ran and flag a scheduler that has stopped. Only runs
 * the scheduler process started count towards that heartbeat - see `JobTrigger`
 * in app/services/scheduler.server.ts.
 */
export async function runJob(
  name: string,
  job: () => Promise<JobResult | void>,
) {
  const startedAt = new Date();
  const scheduled = workerData?.trigger === 'scheduled';
  await recordJobRun(name, {
    lastStartedAt: startedAt,
    ...(scheduled ? { lastScheduledStartAt: startedAt } : {}),
  });

  let result: JobResult;
  try {
    result = { success: true, ...(await job()) };
  } catch (error) {
    console.error(`Job ${name} failed:`, error);
    result = { success: false, error: errorMessage(error) };
  }

  parentPort?.postMessage(result);

  if (result.success) {
    await recordJobRun(name, { lastSucceededAt: new Date() });
  } else {
    await recordJobRun(name, {
      lastFailedAt: new Date(),
      lastError:
        typeof result.error === 'string'
          ? result.error
          : result.message ?? 'Unknown error',
    });
    process.exitCode = 1;
  }

  try {
    await prisma.$disconnect();
  } catch (error) {
    console.error(`Job ${name} could not disconnect from the database:`, error);
  }
}

/**
 * Bookkeeping only - a failure to record must never fail the job itself, or a
 * database hiccup would turn every run into a "failed" one.
 */
async function recordJobRun(
  name: string,
  data: {
    lastStartedAt?: Date;
    lastScheduledStartAt?: Date;
    lastSucceededAt?: Date;
    lastFailedAt?: Date;
    lastError?: string;
  },
) {
  try {
    await prisma.scheduledJobRun.upsert({
      where: { name },
      update: data,
      create: { name, ...data },
    });
  } catch (error) {
    console.error(`Could not record run of job ${name}:`, error);
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error';
}
