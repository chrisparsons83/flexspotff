import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
} from '@remix-run/react';
import Alert from '~/components/ui/Alert';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import { Section } from '~/components/ui/section';
import { getScheduledJobRuns } from '~/models/scheduledJobRun.server';
import { authenticator, requireAdmin } from '~/services/auth.server';
import { getScheduler } from '~/services/scheduler.server';
import { cronToHuman } from '~/utils/cron';
import { SCHEDULED_JOBS } from '~/utils/jobs';
import { isSchedulerStale, timeAgo } from '~/utils/scheduler-health';

type ActionData = {
  message?: string;
  error?: string;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  const formData = await request.formData();
  const action = formData.get('_action');
  const jobName = formData.get('jobName');

  try {
    switch (action) {
      case 'runJob': {
        if (!jobName || typeof jobName !== 'string') {
          return json<ActionData>({ error: 'Job name is required' });
        }

        await getScheduler('manual').runJob(jobName);
        return json<ActionData>({
          message: `Job "${jobName}" executed successfully`,
        });
      }
      default: {
        return json<ActionData>({ error: 'Invalid action' });
      }
    }
  } catch (error) {
    console.error('Scheduler action error:', error);
    return json<ActionData>({
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  // Straight from the registry - listing jobs shouldn't need to construct a
  // Bree instance inside the web server.
  const runs = await getScheduledJobRuns();
  const now = new Date();

  // Ages are worded here rather than in the component, so the server render
  // and the client hydration agree on "now".
  const jobs = SCHEDULED_JOBS.map(job => {
    const run = runs[job.name];
    return {
      ...job,
      lastStarted: run?.lastStartedAt ? timeAgo(run.lastStartedAt, now) : null,
      lastSucceeded: run?.lastSucceededAt
        ? timeAgo(run.lastSucceededAt, now)
        : null,
      lastFailed: run?.lastFailedAt ? timeAgo(run.lastFailedAt, now) : null,
      // Only worth showing while the failure is the latest outcome.
      lastError:
        run?.lastFailedAt &&
        (!run.lastSucceededAt || run.lastFailedAt > run.lastSucceededAt)
          ? run.lastError
          : null,
    };
  });

  // Only cron-started runs count: "Run Now" runs in the web server, so it says
  // nothing about whether the scheduler process is alive.
  const lastScheduledStarts = Object.values(runs).map(
    run => run.lastScheduledStartAt,
  );
  const latestStart = lastScheduledStarts.reduce<Date | null>(
    (latest, at) => (at && (!latest || at > latest) ? at : latest),
    null,
  );

  return json({
    jobs,
    schedulerStale: isSchedulerStale(lastScheduledStarts, now),
    schedulerLastActive: latestStart ? timeAgo(latestStart, now) : null,
  });
};

export default function AdminSchedulerIndex() {
  const { jobs, schedulerStale, schedulerLastActive } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();

  const isRunning = navigation.state !== 'idle';

  return (
    <Section
      title='Scheduler management'
      description='Manage and monitor scheduled tasks.'
    >
      {schedulerStale && (
        <Alert
          status='error'
          message={`The scheduler looks down - no job has started since ${schedulerLastActive}, and live scores are not updating. Restart the container.`}
          className='mb-6'
        />
      )}

      {actionData?.message && (
        <Alert message={actionData.message} className='mb-6' />
      )}
      {actionData?.error && (
        <Alert message={actionData.error} status='error' className='mb-6' />
      )}

      <Section as='h3' title='Scheduled jobs'>
        <div className='grid gap-4'>
          {jobs.map(job => (
            <Card key={job.name}>
              <CardContent className='flex flex-wrap items-start justify-between gap-4'>
                <div>
                  <h4 className='text-lg font-bold'>{job.name}</h4>
                  <p className='text-sm text-muted-foreground '>
                    Schedule: {cronToHuman(job.cron, job.timezone)}
                  </p>
                  <p className='text-sm text-muted-foreground mt-1'>
                    Cron: {job.cron || 'Not scheduled'}
                  </p>
                  <p className='text-sm text-muted-foreground mt-1'>
                    {job.description}
                  </p>
                  <p className='text-sm text-muted-foreground mt-2'>
                    {job.lastStarted
                      ? [
                          `Last started ${job.lastStarted}`,
                          job.lastSucceeded &&
                            `last succeeded ${job.lastSucceeded}`,
                          job.lastFailed && `last failed ${job.lastFailed}`,
                        ]
                          .filter(Boolean)
                          .join(', ')
                      : 'No runs recorded yet'}
                  </p>
                  {job.lastError && (
                    <p className='text-sm text-negative mt-1'>
                      {job.lastError}
                    </p>
                  )}
                </div>
                <Form method='POST' className='inline'>
                  <input type='hidden' name='jobName' value={job.name} />
                  <Button
                    type='submit'
                    name='_action'
                    value='runJob'
                    disabled={isRunning}
                  >
                    Run now
                  </Button>
                </Form>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>
    </Section>
  );
}
