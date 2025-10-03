import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
} from '@remix-run/react';
import Alert from '~/components/ui/Alert';
import Button from '~/components/ui/FlexSpotButton';
import { authenticator, requireAdmin } from '~/services/auth.server';
import { scheduler } from '~/services/scheduler.server';
import { cronToHuman } from '~/utils/cron';

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

        await scheduler.runJob(jobName);
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

  // Get current jobs configuration
  const jobs = scheduler.getJobs();

  return json({ jobs });
};

export default function AdminSchedulerIndex() {
  const { jobs } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();

  const isRunning = navigation.state !== 'idle';

  return (
    <>
      <h2>Scheduler Management</h2>
      <p>Manage and monitor scheduled tasks.</p>

      {actionData?.message && <Alert message={actionData.message} />}
      {actionData?.error && <Alert message={actionData.error} />}

      <div className='space-y-6'>
        <section>
          <h3>Scheduled Jobs</h3>
          <div className='space-y-4'>
            {jobs.map((job, index: number) => (
              <div
                key={index}
                className='border rounded-lg p-4 bg-gray-50 dark:bg-gray-800'
              >
                <div className='flex justify-between items-start'>
                  <div>
                    <h4 className='font-semibold text-lg'>{job.name}</h4>
                    <p className='text-sm text-gray-600 dark:text-gray-400'>
                      Schedule: {cronToHuman(job.cron)}
                    </p>
                    <p className='text-xs text-gray-500 mt-1'>
                      Cron: {job.cron || 'Not scheduled'}
                    </p>
                    {job.name === 'sync-nfl-players' && (
                      <p className='text-sm text-gray-500 mt-1'>
                        Syncs NFL players database from external API
                      </p>
                    )}
                    {job.name === 'sync-leagues' && (
                      <p className='text-sm text-gray-500 mt-1'>
                        Syncs all leagues in the current season with team data
                      </p>
                    )}
                    {job.name === 'monitor-nfl-games' && (
                      <p className='text-sm text-gray-500 mt-1'>
                        Monitors NFL games and triggers score resyncing when games finish
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
                      Run Now
                    </Button>
                  </Form>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
