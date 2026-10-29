import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form } from '@remix-run/react';
import { useEffect, useRef } from 'react';
import {
  typedjson,
  useTypedActionData,
  useTypedLoaderData,
} from 'remix-typedjson';
import z from 'zod';
import Alert from '~/components/ui/Alert';
import { Button } from '~/components/ui/button';
import { Field } from '~/components/ui/field';
import { Input, NativeSelect } from '~/components/ui/input';
import { Link } from '~/components/ui/link';
import { Section } from '~/components/ui/section';
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
      message: 'Draft slot created.',
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
    <Section
      title='Create new draft slot'
      description={<Link to='/admin/draft-slots'>Back to draft slots</Link>}
    >
      {isSuccessWithMessage(actionData) && (
        <Alert message={actionData.message} className='mb-6' />
      )}
      {isErrorResponse(actionData) && (
        <Alert
          message={
            ('general' in actionData.error && actionData.error.general?.[0]) ||
            'Something went wrong. Try again.'
          }
          status='error'
          className='mb-6'
        />
      )}
      <Form
        ref={formRef}
        method='post'
        onSubmit={handleSubmit}
        className='grid max-w-md gap-6'
      >
        <Field
          label='Season'
          error={
            isErrorResponse(actionData) && 'seasonId' in actionData.error
              ? actionData.error.seasonId?.[0]
              : undefined
          }
        >
          <NativeSelect
            name='seasonId'
            required
            defaultValue={
              seasons.find((s: any) => s.isCurrent)?.id || seasons[0]?.id || ''
            }
          >
            <option value=''>Select a season…</option>
            {seasons.map((season: any) => (
              <option key={season.id} value={season.id}>
                {season.year} {season.isCurrent ? '(current)' : ''}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field
          label='Draft date and time'
          description={
            <>
              Enter it in your local timezone,{' '}
              <span suppressHydrationWarning>
                {Intl.DateTimeFormat().resolvedOptions().timeZone}
              </span>
              . Members each see it in their own.
            </>
          }
          error={
            isErrorResponse(actionData) && 'draftDateTime' in actionData.error
              ? actionData.error.draftDateTime?.[0]
              : undefined
          }
        >
          <Input type='datetime-local' id='draftDateTimeLocal' required />
        </Field>
        {/* Populated on submit with the UTC ISO string; see handleSubmit. */}
        <input type='hidden' name='draftDateTime' />
        <div>
          <Button type='submit'>Create draft slot</Button>
        </div>
      </Form>
    </Section>
  );
}
