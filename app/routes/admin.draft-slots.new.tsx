import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form, Link } from '@remix-run/react';
import { useEffect, useRef } from 'react';
import {
  typedjson,
  useTypedActionData,
  useTypedLoaderData,
} from 'remix-typedjson';
import z from 'zod';
import Alert from '~/components/ui/Alert';
import Button from '~/components/ui/Button';
import { createDraftSlot } from '~/models/draftSlot.server';
import { getSeasons } from '~/models/season.server';
import { authenticator, requireAdmin } from '~/services/auth.server';

const draftSlotSchema = z.object({
  draftDateTime: z.string().min(1, 'Draft date and time is required'),
  season: z.string().min(1, 'Season is required').transform((val) => parseInt(val, 10)),
});

export const action = async ({ request }: ActionFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

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
    await createDraftSlot({
      draftDateTime: new Date(draftDateTime),
      season,
    });
    return typedjson({ success: true, message: 'Draft slot created successfully!' });
  } catch (error) {
    console.error('Draft slot creation error:', error);
    return typedjson(
      { success: false, error: { general: ['Failed to create draft slot. Please try again.'] } },
      { status: 500 }
    );
  }
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);
  
  const seasons = await getSeasons();
  return typedjson({ seasons });
};

export default function NewDraftSlot() {
  const { seasons } = useTypedLoaderData<typeof loader>();
  const actionData = useTypedActionData<typeof action>();
  const formRef = useRef<HTMLFormElement>(null);

  // Reset form after successful creation
  useEffect(() => {
    if (actionData?.success) {
      formRef.current?.reset();
    }
  }, [actionData]);

  return (
    <>
      <h2>Create New Draft Slot</h2>
      <p>
        <Link to="/admin/draft-slots">← Back to Draft Slots</Link>
      </p>
      {actionData?.success && actionData.message && (
        <Alert message={actionData.message} />
      )}
      {actionData && !actionData.success && (
        <Alert
          message={
            (actionData as any).error?.general?.[0] || 'An error occurred. Please try again.'
          }
        />
      )}
      <Form ref={formRef} method="post" className='grid grid-cols-1 gap-6'>
        <div>
          <label htmlFor="season">
            Season:
            <select
              name="season"
              id="season"
              className='mt-1 block w-full dark:border-0 dark:bg-slate-800'
              required
              defaultValue={seasons.find((s: any) => s.isCurrent)?.year || seasons[0]?.year || ''}
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
            Create Draft Slot
          </Button>
        </div>
      </Form>
    </>
  );
}
