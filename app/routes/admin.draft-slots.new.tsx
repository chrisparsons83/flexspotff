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
import Button from '~/components/ui/FlexSpotButton';
import { createDraftSlot } from '~/models/draftSlot.server';
import { getSeasons } from '~/models/season.server';
import { authenticator, requireAdmin } from '~/services/auth.server';
import { isSuccessWithMessage, isErrorResponse } from '~/utils/types';

const draftSlotSchema = z.object({
  draftDateTime: z.string().min(1, 'Draft date and time is required'),
  seasonId: z.string().min(1, 'Season is required'),
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
      { status: 400 },
    );
  }

  const { draftDateTime, seasonId } = submission.data;

  try {
    await createDraftSlot({
      draftDateTime: new Date(draftDateTime),
      seasonId,
    });
    return typedjson({
      success: true,
      message: 'Draft slot created successfully!',
    });
  } catch (error) {
    console.error('Draft slot creation error:', error);
    return typedjson(
      {
        success: false,
        error: { general: ['Failed to create draft slot. Please try again.'] },
      },
      { status: 500 },
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

  // Convert the datetime-local wall-clock value (interpreted in the browser's
  // timezone) into an absolute UTC ISO string before the form is submitted, so
  // the server stores the correct instant regardless of its own timezone.
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    const form = event.currentTarget;
    const local = form.querySelector<HTMLInputElement>('#draftDateTimeLocal');
    const hidden = form.querySelector<HTMLInputElement>(
      'input[name="draftDateTime"]',
    );
    if (hidden) {
      hidden.value = local?.value ? new Date(local.value).toISOString() : '';
    }
  };

  return (
    <>
      <h2>Create New Draft Slot</h2>
      <p>
        <Link to='/admin/draft-slots'>← Back to Draft Slots</Link>
      </p>
      {isSuccessWithMessage(actionData) && (
        <Alert message={actionData.message} />
      )}
      {isErrorResponse(actionData) && (
        <Alert
          message={
            ('general' in actionData.error && actionData.error.general?.[0]) ||
            'An error occurred. Please try again.'
          }
        />
      )}
      <Form
        ref={formRef}
        method='post'
        onSubmit={handleSubmit}
        className='grid grid-cols-1 gap-6'
      >
        <div>
          <label htmlFor='seasonId'>
            Season:
            <select
              name='seasonId'
              id='seasonId'
              className='mt-1 block w-full dark:border-0 dark:bg-slate-800'
              required
              defaultValue={
                seasons.find((s: any) => s.isCurrent)?.id ||
                seasons[0]?.id ||
                ''
              }
            >
              <option value=''>Select a season...</option>
              {seasons.map((season: any) => (
                <option key={season.id} value={season.id}>
                  {season.year} {season.isCurrent ? '(Current)' : ''}
                </option>
              ))}
            </select>
          </label>
          {isErrorResponse(actionData) &&
            'seasonId' in actionData.error &&
            actionData.error.seasonId && (
              <p className='form-validation-error' role='alert'>
                {actionData.error.seasonId[0]}
              </p>
            )}
        </div>
        <div>
          <label htmlFor='draftDateTimeLocal'>
            Draft Date & Time (in your local timezone:{' '}
            <span suppressHydrationWarning>
              {Intl.DateTimeFormat().resolvedOptions().timeZone}
            </span>
            ):
            <input
              type='datetime-local'
              id='draftDateTimeLocal'
              className='mt-1 block w-full dark:border-0 dark:bg-slate-800'
              required
            />
          </label>
          {/* Populated on submit with the UTC ISO string; see handleSubmit. */}
          <input type='hidden' name='draftDateTime' />
          {isErrorResponse(actionData) &&
            'draftDateTime' in actionData.error &&
            actionData.error.draftDateTime && (
              <p className='form-validation-error' role='alert'>
                {actionData.error.draftDateTime[0]}
              </p>
            )}
          <p
            style={{
              fontSize: '0.875rem',
              color: '#6b7280',
              marginTop: '0.25rem',
            }}
          >
            Enter the draft time in your local timezone. It will be displayed to
            all users in their respective local timezones.
          </p>
        </div>
        <div>
          {isErrorResponse(actionData) &&
            'general' in actionData.error &&
            actionData.error.general && (
              <p className='form-validation-error' role='alert'>
                {actionData.error.general[0]}
              </p>
            )}
          <Button type='submit'>Create Draft Slot</Button>
        </div>
      </Form>
    </>
  );
}
