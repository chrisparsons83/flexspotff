import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form, Link, useNavigate } from '@remix-run/react';
import { useEffect } from 'react';
import {
  typedjson,
  useTypedActionData,
  useTypedLoaderData,
} from 'remix-typedjson';
import z from 'zod';
import Alert from '~/components/ui/Alert';
import Button from '~/components/ui/Button';
import { getDraftSlot, updateDraftSlot } from '~/models/draftSlot.server';
import { getSeasons } from '~/models/season.server';
import { authenticator, requireAdmin } from '~/services/auth.server';

const draftSlotSchema = z.object({
  draftDateTime: z.string().min(1, 'Draft date and time is required'),
  season: z.string().min(1, 'Season is required').transform(Number),
});

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  const { id } = params;
  if (!id) {
    throw new Response('Not Found', { status: 404 });
  }

  const formData = await request.formData();
  const submission = draftSlotSchema.safeParse(Object.fromEntries(formData));

  if (!submission.success) {
    return typedjson(
      { success: false, error: submission.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { draftDateTime, season } = submission.data;

  try {
    await updateDraftSlot({
      id,
      draftDateTime: new Date(draftDateTime),
      season,
    });
    return typedjson({ success: true, message: 'Draft slot updated successfully' });
  } catch (error) {
    console.error('Draft slot update error:', error);
    return typedjson(
      { success: false, error: { general: ['Failed to update draft slot. Please try again.'] } },
      { status: 500 }
    );
  }
};

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  const { id } = params;
  if (!id) {
    throw new Response('Not Found', { status: 404 });
  }

  const draftSlot = await getDraftSlot({ id });
  if (!draftSlot) {
    throw new Response('Not Found', { status: 404 });
  }

  const seasons = await getSeasons();
  return typedjson({ draftSlot, seasons });
};

export default function EditDraftSlot() {
  const { draftSlot, seasons } = useTypedLoaderData<typeof loader>();
  const actionData = useTypedActionData<typeof action>();
  const navigate = useNavigate();

  useEffect(() => {
    if (actionData?.success) {
      const timer = setTimeout(() => {
        navigate('/admin/draft-slots');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [actionData?.success, navigate]);

  // Format the datetime for the input field
  const formatDateTimeForInput = (date: string | Date) => {
    const d = new Date(date);
    return d.toISOString().slice(0, 16);
  };

  return (
    <>
      <h2>Edit Draft Slot</h2>
      <p>
        <Link to="/admin/draft-slots">← Back to Draft Slots</Link>
      </p>
      {actionData?.success && actionData.message && (
        <Alert message={`${actionData.message} Redirecting...`} />
      )}
      {actionData && !actionData.success && (
        <Alert
          message={
            (actionData as any).error?.general?.[0] || 'An error occurred. Please try again.'
          }
        />
      )}
      <Form method="post" className='grid grid-cols-1 gap-6'>
        <div>
          <label htmlFor="season">
            Season:
            <select
              name="season"
              id="season"
              className='mt-1 block w-full dark:border-0 dark:bg-slate-800'
              required
              defaultValue={draftSlot.season}
            >
              <option value="">Select a season...</option>
              {seasons.map((season: any) => (
                <option key={season.id} value={season.year}>
                  {season.year} {season.isCurrent ? '(Current)' : ''}
                </option>
              ))}
            </select>
          </label>
          {actionData && !actionData.success && (actionData as any).error?.season && (
            <p className='form-validation-error' role='alert'>
              {(actionData as any).error.season[0]}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="draftDateTime">
            Draft Date & Time (in your local timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}):
            <input
              type="datetime-local"
              name="draftDateTime"
              id="draftDateTime"
              defaultValue={formatDateTimeForInput(draftSlot.draftDateTime)}
              className='mt-1 block w-full dark:border-0 dark:bg-slate-800'
              required
            />
          </label>
          {actionData && !actionData.success && (actionData as any).error?.draftDateTime && (
            <p className='form-validation-error' role='alert'>
              {(actionData as any).error.draftDateTime[0]}
            </p>
          )}
          <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
            Enter the draft time in your local timezone. It will be displayed to all users in their respective local timezones.
          </p>
        </div>
        <div>
          {actionData && !actionData.success && (actionData as any).error?.general && (
            <p className='form-validation-error' role='alert'>
              {(actionData as any).error.general[0]}
            </p>
          )}
          <Button type="submit">
            Update Draft Slot
          </Button>
        </div>
      </Form>
    </>
  );
}
