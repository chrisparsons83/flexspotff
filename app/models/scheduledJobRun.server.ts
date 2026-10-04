import { prisma } from '~/db.server';

/** The latest run of every job that has run at least once, keyed by job name. */
export async function getScheduledJobRuns() {
  const runs = await prisma.scheduledJobRun.findMany();
  return Object.fromEntries(runs.map(run => [run.name, run]));
}
