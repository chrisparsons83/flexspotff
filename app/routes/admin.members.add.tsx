import type { ActionArgs } from '@remix-run/node';
import { Form, useNavigation } from '@remix-run/react';
import { useEffect, useRef } from 'react';
import { z } from 'zod';
import Alert from '~/components/ui/Alert';
import Button from '~/components/ui/Button';
import { createOrUpdateSleeperUser } from '~/models/sleeperUser.server';
import { createUser } from '~/models/user.server';
import { authenticator, requireAdmin } from '~/services/auth.server';
import { superjson, useSuperActionData } from '~/utils/data';

const zFormData = z.object({
  discordName: z.string(),
  discordId: z.string(),
  sleeperOwnerId: z.string(),
});

type ActionData = {
  formError?: string;
  fieldErrors?: {
    discordName?: string;
    discordId?: string;
    sleeperOwnerId?: string;
  };
  fields?: {
    discordName: string;
    discordId: string;
    sleeperOwnerId: string;
  };
  message?: string;
  success?: boolean;
};

export const action = async ({
  request,
}: ActionArgs): Promise<Response | ActionData> => {
  const currentUser = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(currentUser);

  const formData = await request.formData();
  const discordName = formData.get('discordName');
  const discordId = formData.get('discordId');
  const sleeperOwnerId = formData.get('sleeperOwnerId');

  const fields = { discordName, discordId, sleeperOwnerId };
  const parsedFormData = zFormData.parse(fields);

  const user = await createUser(
    parsedFormData.discordId,
    parsedFormData.discordName,
    '', // I don't really care about avatars for old users in this case.
  );
  await createOrUpdateSleeperUser({
    userId: user.id,
    sleeperOwnerID: parsedFormData.sleeperOwnerId,
  });

  return superjson<ActionData>(
    {
      message: `User ${parsedFormData.discordName} added.`,
      success: true,
    },
    { headers: { 'x-superjson': 'true' } },
  );
};

export default function MembersAdd() {
  const actionData = useSuperActionData<ActionData>();
  const navigation = useNavigation();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (navigation.state === 'idle' && actionData?.success) {
      formRef.current?.reset();
    }
  }, [actionData?.success, navigation.state]);

  const buttonText =
    navigation.state === 'submitting'
      ? 'Adding...'
      : navigation.state === 'loading'
      ? 'Added!'
      : 'Add';

  return (
    <article>
      <h2>Add Member</h2>
      <p>
        This is to add a member manually to the system. You almost never want to
        do this, you would much rather them log in via Discord so that this is
        all handled automatically. This is only really here so Chris can enter
        in historical data much easier and get things all synced up.
      </p>
      {actionData?.message && <Alert message={actionData.message} />}
      <Form method='POST' className='grid grid-cols-1 gap-6' ref={formRef}>
        <div>
          <label htmlFor='discordName'>
            Discord Name
            <input
              type='text'
              required
              name='discordName'
              id='discordName'
              aria-invalid={
                Boolean(actionData?.fieldErrors?.discordName) || undefined
              }
              aria-errormessage={
                actionData?.fieldErrors?.discordName
                  ? 'discordName-error'
                  : undefined
              }
              className='mt-1 block w-full dark:border-0 dark:bg-slate-800'
            />
          </label>
        </div>
        <div>
          <label htmlFor='discordId'>
            Discord ID
            <input
              type='text'
              required
              name='discordId'
              id='discordId'
              aria-invalid={
                Boolean(actionData?.fieldErrors?.discordId) || undefined
              }
              aria-errormessage={
                actionData?.fieldErrors?.discordId
                  ? 'discordId-error'
                  : undefined
              }
              className='mt-1 block w-full dark:border-0 dark:bg-slate-800'
            />
          </label>
        </div>
        <div>
          <label htmlFor='discordId'>
            Sleeper Owner ID
            <input
              type='text'
              required
              name='sleeperOwnerId'
              id='sleeperOwnerId'
              aria-invalid={
                Boolean(actionData?.fieldErrors?.sleeperOwnerId) || undefined
              }
              aria-errormessage={
                actionData?.fieldErrors?.sleeperOwnerId
                  ? 'sleeperOwnerId-error'
                  : undefined
              }
              className='mt-1 block w-full dark:border-0 dark:bg-slate-800'
            />
          </label>
        </div>
        <div>
          {actionData?.formError ? (
            <p className='form-validation-error' role='alert'>
              {actionData.formError}
            </p>
          ) : null}
          <Button
            type='submit'
            disabled={navigation.state !== 'idle'}
            name='_action'
            value='_add'
          >
            {buttonText}
          </Button>
        </div>
      </Form>
    </article>
  );
}
