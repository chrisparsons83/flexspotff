/**
 * The single source of truth for scheduled jobs.
 *
 * Every `name` here must match a file at `jobs/<name>.ts`. Three things read
 * this list, and they used to drift apart:
 *   - `app/services/scheduler.server.ts` registers them with Bree
 *   - `jobs/tsup.config.ts` derives its build entry points from it
 *   - `app/routes/admin.scheduler._index.tsx` renders the descriptions
 *
 * That last drift was expensive: a job was registered with Bree but never added
 * to the tsup entry list, so its `.cjs` never got built. Bree stats every job
 * path during `init()` and throws on the first miss, which took down the whole
 * scheduler process - not just the one job.
 */
export type ScheduledJob = {
  name: string;
  /** UTC. The container has no TZ set, so these are not local times. */
  cron: string;
  description: string;
};

export const SCHEDULED_JOBS: ScheduledJob[] = [
  {
    name: 'sync-nfl-players',
    cron: '0 5 * * 2',
    description:
      'Syncs the NFL player database from Sleeper. Tuesdays at 05:00 UTC.',
  },
  {
    name: 'sync-leagues',
    cron: '0 7 * * 2',
    description:
      'Syncs every league in the current season - rosters, records, draft order, and ADP. Tuesdays at 07:00 UTC.',
  },
  {
    name: 'monitor-scores',
    cron: '*/5 * * * *',
    description:
      'Syncs NFL game state every 5 minutes, and resyncs league and D12 scores whenever games are in progress.',
  },
  {
    name: 'sync-d12-scores',
    cron: '0 7 * * 2',
    description:
      'Full-season D12 backfill, to pick up weeks the live monitor missed and any late Sleeper corrections. Tuesdays at 07:00 UTC.',
  },
];

export const SCHEDULED_JOB_ENTRIES = SCHEDULED_JOBS.map(
  job => `jobs/${job.name}.ts`,
);
