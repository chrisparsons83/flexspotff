import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form, useNavigation } from '@remix-run/react';
import {
  typedjson,
  useTypedActionData,
  useTypedLoaderData,
} from 'remix-typedjson';
import Alert from '~/components/ui/Alert';
import Button from '~/components/ui/FlexSpotButton';
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
        ? 'Sleeper Owner ID has no content'
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
    case AdminMembersEditOptions.Add:
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

  return typedjson({ message: undefined, fieldErrors, fields });
};

export const loader = async ({ params }: LoaderFunctionArgs) => {
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
      ? 'Adding...'
      : navigation.state === 'loading'
      ? 'Added!'
      : 'Add';

  return (
    <>
      <h2>Edit User {user.discordName}</h2>
      {actionData?.message && <Alert message={actionData.message} />}
      <h3>Existing Account IDs</h3>
      <table>
        <tr>
          <th>Sleeper Owner ID</th>
          <th>Action</th>
        </tr>
        {sleeperUsers.map(({ sleeperOwnerID }) => (
          <tr key={sleeperOwnerID}>
            <td>{sleeperOwnerID}</td>
            <td>
              <Form method='POST'>
                <input
                  type='hidden'
                  name='sleeperOwnerID'
                  value={sleeperOwnerID}
                />
                <Button
                  type='submit'
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
      </table>
      <Form method='POST' className='grid grid-cols-1 gap-6'>
        <div>
          <label htmlFor='sleeperOwnerID'>
            Add Sleeper Owner ID:
            <input
              type='text'
              required
              name='sleeperOwnerID'
              id='sleeperOwnerID'
              aria-invalid={
                Boolean(actionData?.fieldErrors?.sleeperOwnerID) || undefined
              }
              aria-errormessage={
                actionData?.fieldErrors?.sleeperOwnerID
                  ? 'sleeperOwnerID-error'
                  : undefined
              }
              className='mt-1 block w-full dark:border-0 dark:bg-slate-800'
            />
          </label>
          {actionData?.fieldErrors?.sleeperOwnerID ? (
            <p
              className='form-validation-error'
              role='alert'
              id='sleeperOwnerID-error'
            >
              {actionData.fieldErrors.sleeperOwnerID}
            </p>
          ) : null}
        </div>
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
    </>
  );
}
