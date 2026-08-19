import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form, Link, useNavigation } from '@remix-run/react';
import {
  typedjson,
  useTypedActionData,
  useTypedLoaderData,
} from 'remix-typedjson';
import { z } from 'zod';
import Alert from '~/components/ui/Alert';
import Button from '~/components/ui/FlexSpotButton';
import MemberSelect from '~/components/ui/MemberSelect';
import { getUsers } from '~/models/user.server';
import {
  MergeGuardError,
  findDuplicateCandidates,
  getMergedUsersWithLeftovers,
  mergeUsers,
  planUserMerge,
} from '~/models/userMerge.server';
import { authenticator, requireAdmin } from '~/services/auth.server';

// required_error as well as min(1): an unselected MemberSelect posts an empty
// string, but a form that never rendered the field at all posts nothing, and
// zod's default "Required" tells an admin nothing about which picker is blank.
const zFormData = z.object({
  _action: z.enum(['preview', 'merge']),
  duplicateId: z
    .string({ required_error: 'Pick the duplicate member.' })
    .min(1, 'Pick the duplicate member.'),
  canonicalId: z
    .string({ required_error: 'Pick the member to merge them into.' })
    .min(1, 'Pick the member to merge them into.'),
});

export const action = async ({ request }: ActionFunctionArgs) => {
  // The admin layout only requires an editor, and layout loaders do not guard
  // child actions, so this has to check for admin itself.
  const currentUser = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(currentUser);

  const formData = await request.formData();
  const parsedFormData = zFormData.safeParse(Object.fromEntries(formData));

  if (!parsedFormData.success) {
    return typedjson({
      kind: 'result' as const,
      message: parsedFormData.error.issues[0].message,
      status: 'error' as const,
    });
  }

  const { _action, duplicateId, canonicalId } = parsedFormData.data;

  try {
    if (_action === 'preview') {
      return typedjson({
        kind: 'preview' as const,
        plan: await planUserMerge(duplicateId, canonicalId),
      });
    }

    const plan = await mergeUsers(duplicateId, canonicalId, currentUser.id);

    return typedjson({
      kind: 'result' as const,
      message: `${plan.duplicate.discordName} is now merged into ${
        plan.canonical.discordName
      } (${plan.totalMoving} row${plan.totalMoving === 1 ? '' : 's'} moved${
        plan.totalStaying ? `, ${plan.totalStaying} left in place` : ''
      }).`,
      status: 'success' as const,
    });
  } catch (error) {
    if (error instanceof MergeGuardError) {
      return typedjson({
        kind: 'result' as const,
        message: error.message,
        status: 'error' as const,
      });
    }

    // A unique violation here means something was written between the preview
    // and the confirm. The whole transaction rolled back, so nothing partial
    // landed and re-previewing is the fix.
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      return typedjson({
        kind: 'result' as const,
        message:
          'This data changed while you were looking at the preview. Nothing was merged - run the preview again.',
        status: 'error' as const,
      });
    }

    throw error;
  }
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const currentUser = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(currentUser);

  const [members, suggestions, alreadyMerged] = await Promise.all([
    getUsers(),
    findDuplicateCandidates(),
    getMergedUsersWithLeftovers(),
  ]);

  return typedjson({
    members: members.map(({ id, discordName }) => ({ id, discordName })),
    suggestions,
    alreadyMerged,
  });
};

export default function MergeMembers() {
  const { members, suggestions, alreadyMerged } =
    useTypedLoaderData<typeof loader>();
  const actionData = useTypedActionData<typeof action>();
  const navigation = useNavigation();

  const isBusy = navigation.state !== 'idle';
  const preview = actionData?.kind === 'preview' ? actionData.plan : null;

  return (
    <>
      <h2 className='mt-0'>Merge Duplicate Members</h2>
      <p>
        When the same person exists twice - usually because they were{' '}
        <Link to='/admin/members/add'>added by hand</Link> for old seasons and
        later logged in with Discord - this moves everything the duplicate owns
        onto the member you keep, so their career record stops being split in
        two. The duplicate's row stays behind so their Discord login still
        resolves here instead of splitting the history again. Nothing is ever
        deleted.
      </p>

      {actionData?.kind === 'result' && (
        <Alert message={actionData.message} status={actionData.status} />
      )}

      <Form
        method='POST'
        className='not-prose my-6 flex flex-wrap items-end gap-4'
      >
        <label className='flex flex-col gap-1'>
          <span className='text-sm font-medium'>Duplicate (goes away)</span>
          <MemberSelect
            name='duplicateId'
            members={members}
            defaultValue={preview?.duplicate.id}
            placeholder='Select duplicate...'
          />
        </label>
        <label className='flex flex-col gap-1'>
          <span className='text-sm font-medium'>
            Keep (receives everything)
          </span>
          <MemberSelect
            name='canonicalId'
            members={members}
            defaultValue={preview?.canonical.id}
            placeholder='Select member to keep...'
          />
        </label>
        <Button type='submit' name='_action' value='preview' disabled={isBusy}>
          Preview
        </Button>
      </Form>

      {preview && (
        <section className='my-6'>
          <h3>
            {preview.duplicate.discordName} &rarr;{' '}
            {preview.canonical.discordName}
          </h3>

          {preview.warnings.map(warning => (
            <Alert key={warning} message={warning} status='warning' />
          ))}

          {preview.tables.length === 0 ? (
            <p>
              {preview.duplicate.discordName} owns no data to move. Merging
              still records the link, so their Discord login resolves to{' '}
              {preview.canonical.discordName} from now on.
            </p>
          ) : (
            <table className='w-full'>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Moving</th>
                  <th>Staying behind</th>
                  <th>Why</th>
                </tr>
              </thead>
              <tbody>
                {preview.tables.map(table => (
                  <tr key={table.table}>
                    <td>
                      {table.label}
                      {table.cascaded?.length ? (
                        <ul className='!my-0 text-sm opacity-75'>
                          {table.cascaded.map(child => (
                            <li key={child.label} className='!my-0'>
                              {child.label}: {child.moving} moving
                              {child.staying > 0
                                ? `, ${child.staying} staying`
                                : ''}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </td>
                    <td>{table.movingIds.length}</td>
                    <td>{table.stayingIds.length}</td>
                    <td>
                      {table.stayingIds.length ? table.stayingReason : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {preview.totalStaying > 0 && (
            <Alert
              status='warning'
              message={`${preview.totalStaying} row(s) stay on the old account because ${preview.canonical.discordName} already has an entry in that slot. Nothing is deleted, but those stay split.`}
            />
          )}

          {preview.tombstonesToRepoint.length > 0 && (
            <Alert
              status='warning'
              message={`${preview.tombstonesToRepoint.length} previously merged account(s) point at ${preview.duplicate.discordName} and will be re-pointed at ${preview.canonical.discordName}.`}
            />
          )}

          <Form method='POST' className='not-prose mt-4'>
            <input
              type='hidden'
              name='duplicateId'
              value={preview.duplicate.id}
            />
            <input
              type='hidden'
              name='canonicalId'
              value={preview.canonical.id}
            />
            <Button
              type='submit'
              name='_action'
              value='merge'
              disabled={isBusy}
            >
              {`Merge ${preview.duplicate.discordName} into ${preview.canonical.discordName}`}
            </Button>
          </Form>
        </section>
      )}

      <h3>Possible duplicates</h3>
      {suggestions.length === 0 ? (
        <p>No likely duplicates found.</p>
      ) : (
        <table className='w-full'>
          <thead>
            <tr>
              <th>Duplicate</th>
              <th>Keep</th>
              <th>Why flagged</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {suggestions.map(suggestion => (
              <tr key={`${suggestion.left.id}:${suggestion.right.id}`}>
                <td>
                  {suggestion.left.discordName}{' '}
                  <span className='text-sm opacity-75'>
                    ({suggestion.left.teamCount} season
                    {suggestion.left.teamCount === 1 ? '' : 's'})
                  </span>
                </td>
                <td>
                  {suggestion.right.discordName}{' '}
                  <span className='text-sm opacity-75'>
                    ({suggestion.right.teamCount} season
                    {suggestion.right.teamCount === 1 ? '' : 's'})
                  </span>
                </td>
                <td>{suggestion.reason}</td>
                <td className='not-prose'>
                  <Form method='POST'>
                    <input
                      type='hidden'
                      name='duplicateId'
                      value={suggestion.left.id}
                    />
                    <input
                      type='hidden'
                      name='canonicalId'
                      value={suggestion.right.id}
                    />
                    <Button
                      type='submit'
                      name='_action'
                      value='preview'
                      disabled={isBusy}
                    >
                      Preview
                    </Button>
                  </Form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3>Already merged</h3>
      {alreadyMerged.length === 0 ? (
        <p>No members have been merged yet.</p>
      ) : (
        <>
          <p>
            A member who was already logged in when they were merged keeps
            submitting as themselves until their session expires. Anything that
            lands on them afterwards shows up here, and re-running the merge
            sweeps it up.
          </p>
          <table className='w-full'>
            <thead>
              <tr>
                <th>Merged member</th>
                <th>Merged into</th>
                <th>Rows left behind</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {alreadyMerged.map(user => (
                <tr key={user.id}>
                  <td>{user.discordName}</td>
                  <td>{user.mergedInto?.discordName}</td>
                  <td>{user.leftoverCount}</td>
                  <td className='not-prose'>
                    {user.leftoverCount > 0 && user.mergedInto && (
                      <Form method='POST'>
                        <input
                          type='hidden'
                          name='duplicateId'
                          value={user.id}
                        />
                        <input
                          type='hidden'
                          name='canonicalId'
                          value={user.mergedInto.id}
                        />
                        <Button
                          type='submit'
                          name='_action'
                          value='preview'
                          disabled={isBusy}
                        >
                          Preview re-merge
                        </Button>
                      </Form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}
