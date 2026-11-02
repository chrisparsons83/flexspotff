import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form, useNavigate } from '@remix-run/react';
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
import { getDraftSlot, updateDraftSlot } from '~/models/draftSlot.server';
import { getSeasons } from '~/models/season.server';
import { authenticator, requireAdmin } from '~/services/auth.server';
import { isSuccessWithMessage, isErrorResponse } from '~/utils/types';

const draftSlotSchema = z.object({
  draftDateTime: z.string().min(1, 'Draft date and time is required'),
  seasonId: z.string().min(1, 'Season is required'),
});

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  const { id } = params;
  if (!id) {
    throw new Response('Not found', { status: 404 });
  }

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
    await updateDraftSlot({
      id,
      draftDateTime: new Date(draftDateTime),
      seasonId,
    });
    return typedjson({
      success: true,
      message: 'Draft slot updated successfully',
    });
  } catch (error) {
    console.error('Draft slot update error:', error);
    return typedjson(
      {
        success: false,
        error: { general: ['Failed to update draft slot. Please try again.'] },
      },
      { status: 500 },
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
    throw new Response('Not found', { status: 404 });
  }

  const draftSlot = await getDraftSlot({ id });
  if (!draftSlot) {
    throw new Response('Not found', { status: 404 });
  }

  const seasons = await getSeasons();
  return typedjson({ draftSlot, seasons });
};

export default function EditDraftSlot() {
  const { draftSlot, seasons } = useTypedLoaderData<typeof loader>();
  const actionData = useTypedActionData<typeof action>();
  const navigate = useNavigate();
  const dateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (actionData?.success) {
      const timer = setTimeout(() => {
        navigate('/admin/draft-slots');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [actionData?.success, navigate]);

  // Format the stored UTC instant into a datetime-local value using the
  // browser's local wall-clock (getFullYear/getMonth/... are local getters).
  const toLocalInputValue = (date: string | Date) => {
    const d = new Date(date);
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
      `T${pad(d.getHours())}:${pad(d.getMinutes())}`
    );
  };

  // Prefill the input on the client, where the browser timezone is known. Doing
  // this during SSR would use the server (UTC) zone and show a shifted time.
  useEffect(() => {
    if (dateInputRef.current) {
      dateInputRef.current.value = toLocalInputValue(draftSlot.draftDateTime);
    }
  }, [draftSlot.draftDateTime]);

  // Convert the local wall-clock value into an absolute UTC ISO string before
  // submit, so the server stores the correct instant regardless of its zone.
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
      title='Edit Draft Slot'
      description={<Link to='/admin/draft-slots'>Back to Draft Slots</Link>}
    >
      {isSuccessWithMessage(actionData) && (
        <Alert
          message={`${actionData.message} Redirecting…`}
          className='mb-6'
        />
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
            defaultValue={draftSlot.seasonId}
          >
            <option value=''>Select a Season…</option>
            {seasons.map((season: any) => (
              <option key={season.id} value={season.id}>
                {season.year} {season.isCurrent ? '(current)' : ''}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field
          label='Draft Date and Time'
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
          <Input
            ref={dateInputRef}
            type='datetime-local'
            id='draftDateTimeLocal'
            required
          />
        </Field>
        {/* Populated on submit with the UTC ISO string; see handleSubmit. */}
        <input type='hidden' name='draftDateTime' />
        <div>
          <Button type='submit'>Update Draft Slot</Button>
        </div>
      </Form>
    </Section>
  );
}
