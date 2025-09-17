import type { ActionFunctionArgs } from '@remix-run/node';
import { Form, useNavigation } from '@remix-run/react';
import { useEffect, useRef } from 'react';
import { typedjson, useTypedActionData } from 'remix-typedjson';
import { z } from 'zod';
import Alert from '~/components/ui/Alert';
import Button from '~/components/ui/FlexSpotButton';
import { createOrUpdateSleeperUser } from '~/models/sleeperUser.server';
import { createUser } from '~/models/user.server';
import { authenticator, requireAdmin } from '~/services/auth.server';

const zFormData = z.object({
  discordName: z.string(),
  discordId: z.string(),
  sleeperOwnerId: z.string(),
});

export const action = async ({ request }: ActionFunctionArgs) => {
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

  return typedjson(
    {
      message: `User ${parsedFormData.discordName} added.`,
      success: true,
    },
    { headers: { 'x-superjson': 'true' } },
  );
};

export default function MembersAdd() {
  const actionData = useTypedActionData<typeof action>();
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
              className='mt-1 block w-full dark:border-0 dark:bg-slate-800'
            />
          </label>
        </div>
        <div>
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
