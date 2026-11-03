import { prisma } from '~/db.server';

/** The latest run of every job that has run at least once, keyed by job name. */
export async function getScheduledJobRuns() {
  const runs = await prisma.scheduledJobRun.findMany();
  return Object.fromEntries(runs.map(run => [run.name, run]));
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Midnight UTC on the day `at` falls on, `daysBack` days earlier. */
function utcDay(at: Date, daysBack = 0) {
  return new Date(
    Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()) -
      daysBack * DAY_MS,
  );
}

/** The week is today plus the six days before it, in UTC. */
const weekStart = (now: Date) => utcDay(now, 6);

/**
 * Adds a run's Sleeper calls to its job's count for the day, and drops days
 * that have fallen out of the week so the table stays a handful of rows.
 */
export async function recordSleeperCalls(
  jobName: string,
  calls: number,
  at: Date,
) {
  const day = utcDay(at);
  await prisma.sleeperCallDay.upsert({
    where: { jobName_day: { jobName, day } },
    update: { calls: { increment: calls } },
    create: { jobName, day, calls },
  });
  await prisma.sleeperCallDay.deleteMany({
    where: { day: { lt: weekStart(at) } },
  });
}

/** Each job's Sleeper calls over the past week, keyed by job name. */
export async function getSleeperCallsPastWeek(now: Date) {
  const totals = await prisma.sleeperCallDay.groupBy({
    by: ['jobName'],
    where: { day: { gte: weekStart(now) } },
    _sum: { calls: true },
  });
  return Object.fromEntries(
    totals.map(total => [total.jobName, total._sum.calls ?? 0]),
  );
}
