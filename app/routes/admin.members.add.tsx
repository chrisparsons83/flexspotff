import type { ActionFunctionArgs } from '@remix-run/node';
import { Form, useNavigation } from '@remix-run/react';
import { useEffect, useRef } from 'react';
import { typedjson, useTypedActionData } from 'remix-typedjson';
import { z } from 'zod';
import Alert from '~/components/ui/Alert';
import { Button } from '~/components/ui/button';
import { Field } from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { Section } from '~/components/ui/section';
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
      ? 'Adding…'
      : navigation.state === 'loading'
      ? 'Added'
      : 'Add';

  return (
    <Section
      title='Add Member'
      description='Adds a member by hand. You almost never want this: a member who logs in with Discord is set up automatically. It is here for entering historical data.'
    >
      {actionData?.message && (
        <Alert message={actionData.message} className='mb-6' />
      )}
      <Form method='POST' className='grid max-w-sm gap-6' ref={formRef}>
        <Field label='Discord Name'>
          <Input required name='discordName' />
        </Field>
        <Field label='Discord ID'>
          <Input required name='discordId' />
        </Field>
        <Field label='Sleeper Owner ID'>
          <Input required name='sleeperOwnerId' />
        </Field>
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
    </Section>
  );
}
