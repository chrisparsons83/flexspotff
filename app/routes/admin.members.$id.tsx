import type { ActionArgs, LoaderArgs } from '@remix-run/node';
import { Form, useTransition } from '@remix-run/react';

import type { SleeperUser } from '~/models/sleeperUser.server';
import {
  createOrUpdateSleeperUser,
  deleteSleeperUser,
  getSleeperOwnerIdsByUserId,
} from '~/models/sleeperUser.server';
import type { User } from '~/models/user.server';
import { getUser } from '~/models/user.server';

import Alert from '~/components/ui/Alert';
import Button from '~/components/ui/Button';
import { authenticator, requireAdmin } from '~/services/auth.server';
import {
  superjson,
  useSuperActionData,
  useSuperLoaderData,
} from '~/utils/data';

enum AdminMembersEditOptions {
  Add = 'add',
  Remove = 'remove',
}

type ActionData = {
  formError?: string;
  fieldErrors?: {
    sleeperOwnerID: string | undefined;
  };
  fields?: {
    sleeperOwnerID: string;
  };
  message?: string;
};

type LoaderData = {
  user: User;
  sleeperUsers: SleeperUser[];
};

export const action = async ({
  params,
  request,
}: ActionArgs): Promise<Response | ActionData> => {
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
    return { fieldErrors, fields };
  }

  switch (action) {
    case AdminMembersEditOptions.Remove:
      await deleteSleeperUser(sleeperOwnerID);
      return superjson<ActionData>(
        {
          message: `sleeperOwnerID ${sleeperOwnerID} removed.`,
        },
        { headers: { 'x-superjson': 'true' } },
      );
    case AdminMembersEditOptions.Add:
      await createOrUpdateSleeperUser({
        userId: params.id,
        sleeperOwnerID,
      });
      return superjson<ActionData>(
        {
          message: 'ID added.',
        },
        { headers: { 'x-superjson': 'true' } },
      );
  }

  return superjson({});
};

export const loader = async ({ params }: LoaderArgs) => {
  if (!params.id) {
    throw new Error('Error building page.');
  }

  const user = await getUser(params.id);

  if (!user) {
    throw new Error('Member not found');
  }

  const sleeperUsers = await getSleeperOwnerIdsByUserId(user.id);

  return superjson<LoaderData>(
    { user, sleeperUsers },
    { headers: { 'x-superjson': 'true' } },
  );
};

export default function EditUser() {
  const { user, sleeperUsers } = useSuperLoaderData<typeof loader>();
  const actionData = useSuperActionData<ActionData>();
  const transition = useTransition();

  const buttonText =
    transition.state === 'submitting'
      ? 'Adding...'
      : transition.state === 'loading'
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
                  disabled={transition.state !== 'idle'}
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
          {actionData?.formError ? (
            <p className='form-validation-error' role='alert'>
              {actionData.formError}
            </p>
          ) : null}
          <Button
            type='submit'
            disabled={transition.state !== 'idle'}
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
