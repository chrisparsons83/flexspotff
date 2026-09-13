import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson } from 'remix-typedjson';
import { syncCurrentWeekScores } from '~/libs/scoring.server';

/**
 * External cron entry point for the current week's scores.
 *
 * DEPRECATED. The `monitor-scores` job does this on a five-minute schedule, so
 * this route only exists as a fallback for whatever external cron predates the
 * scheduler. It no longer carries its own copy of the sync logic - that copy
 * had drifted from the job's and knew nothing about D12.
 *
 * Once the scheduler process is confirmed healthy in production and any
 * external caller has been turned off, delete this route and drop API_KEY.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Security check, since this is called by a cron job outside the app.
  const url = new URL(request.url);
  const apiKey = url.searchParams.get('apiKey');
  if (process.env.API_KEY !== apiKey) {
    throw new Response('Invalid request', {
      status: 403,
    });
  }

  const report = await syncCurrentWeekScores();
  if (!report.synced) {
    throw new Response(report.message, { status: 400 });
  }

  return typedjson(report);
};
