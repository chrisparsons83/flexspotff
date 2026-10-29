import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form, useNavigation } from '@remix-run/react';
import {
  typedjson,
  useTypedActionData,
  useTypedLoaderData,
} from 'remix-typedjson';
import Alert from '~/components/ui/Alert';
import { Button } from '~/components/ui/button';
import { Field } from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { Section } from '~/components/ui/section';
import { Table } from '~/components/ui/table';
import {
  createOrUpdateSleeperUser,
  deleteSleeperUser,
  getSleeperOwnerIdsByUserId,
} from '~/models/sleeperUser.server';
import { getUser } from '~/models/user.server';
import { authenticator, requireAdmin } from '~/services/auth.server';

enum AdminMembersEditOptions {
  Add = 'add',
  Remove = 'remove',
}

export const action = async ({ params, request }: ActionFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  const formData = await request.formData();
  const sleeperOwnerID = formData.get('sleeperOwnerID');
  const action = formData.get('_action');

  if (typeof sleeperOwnerID !== 'string') {
    throw new Error(`Form not submitted correctly`);
  }
  if (!params.id) {
    throw new Error(`Form not submitted correctly - user ID missing`);
  }

  const fields = { sleeperOwnerID };

  const fieldErrors = {
    sleeperOwnerID:
      sleeperOwnerID.length === 0
        ? 'Sleeper owner ID has no content'
        : undefined,
  };
  if (Object.values(fieldErrors).some(Boolean)) {
    return typedjson({ fieldErrors, fields, message: undefined });
  }

  switch (action) {
    case AdminMembersEditOptions.Remove:
      await deleteSleeperUser(sleeperOwnerID);
      return typedjson({
        message: `sleeperOwnerID ${sleeperOwnerID} removed.`,
        fieldErrors,
        fields,
      });
    case AdminMembersEditOptions.Add: {
      // Pointing a Sleeper account at a merged-away member would strand its
      // teams on an account nobody can log into, and the next league sync
      // would detach them from the record book entirely.
      const member = await getUser(params.id);
      if (member?.mergedIntoId) {
        return typedjson({
          message: `${member.discordName} was merged into another member. Add this Sleeper ID to the member they were merged into instead.`,
          fieldErrors,
          fields,
        });
      }

      await createOrUpdateSleeperUser({
        userId: params.id,
        sleeperOwnerID,
      });
      return typedjson({
        message: 'ID added.',
        fieldErrors,
        fields,
      });
    }
  }

  return typedjson({ message: undefined, fieldErrors, fields });
};

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const currentUser = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(currentUser);

  if (!params.id) {
    throw new Error('Error building page.');
  }

  const user = await getUser(params.id);

  if (!user) {
    throw new Error('Member not found');
  }

  const sleeperUsers = await getSleeperOwnerIdsByUserId(user.id);

  return typedjson({ user, sleeperUsers });
};

export default function EditUser() {
  const { user, sleeperUsers } = useTypedLoaderData<typeof loader>();
  const actionData = useTypedActionData<typeof action>();
  const navigation = useNavigation();

  const buttonText =
    navigation.state === 'submitting'
      ? 'Adding…'
      : navigation.state === 'loading'
      ? 'Added'
      : 'Add';

  return (
    <Section title={`Edit member ${user.discordName}`}>
      {actionData?.message && (
        <Alert message={actionData.message} className='mb-6' />
      )}
      <Section as='h3' title='Sleeper accounts'>
        <Table headers={['Sleeper owner ID', 'Action']}>
          {sleeperUsers.map(({ sleeperOwnerID }) => (
            <tr key={sleeperOwnerID}>
              <td className='font-mono'>{sleeperOwnerID}</td>
              <td>
                <Form method='POST'>
                  <input
                    type='hidden'
                    name='sleeperOwnerID'
                    value={sleeperOwnerID}
                  />
                  <Button
                    type='submit'
                    variant='secondary'
                    size='sm'
                    disabled={navigation.state !== 'idle'}
                    name='_action'
                    value={AdminMembersEditOptions.Remove}
                  >
                    Remove
                  </Button>
                </Form>
              </td>
            </tr>
          ))}
        </Table>
        <Form method='POST' className='mt-6 grid max-w-sm gap-6'>
          <Field
            label='Sleeper owner ID'
            error={actionData?.fieldErrors?.sleeperOwnerID}
          >
            <Input required name='sleeperOwnerID' />
          </Field>
          <div>
            <Button
              type='submit'
              disabled={navigation.state !== 'idle'}
              name='_action'
              value={AdminMembersEditOptions.Add}
            >
              {buttonText}
            </Button>
          </div>
        </Form>
      </Section>
    </Section>
  );
}
