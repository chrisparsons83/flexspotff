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
  /** UTC unless `timezone` is set. The container has no TZ set. */
  cron: string;
  /**
   * IANA zone for a job that has to hold a wall-clock local time across DST.
   * Bree validates this and passes it through to its scheduler.
   */
  timezone?: string;
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
  {
    name: 'post-waiver-report',
    cron: '20,35,50 0 * * 3',
    timezone: 'America/Los_Angeles',
    description:
      "Posts each league's waiver claims and failed bids to the waiver report channel. Wednesdays at 12:20am PT - the last league's batch lands around 12:14 - retrying at 12:35 and 12:50 for any league Sleeper has not finished processing.",
  },
];

export const SCHEDULED_JOB_ENTRIES = SCHEDULED_JOBS.map(
  job => `jobs/${job.name}.ts`,
);
