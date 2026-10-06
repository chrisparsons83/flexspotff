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
import MemberSelect, { toSelectableMember } from '~/components/ui/MemberSelect';
import { suggestFromSleeperHandles } from '~/libs/survivor/suggest';
import { syncSleeperSurvivorPool } from '~/libs/survivor/sync.server';
import {
  getSleeperUserByOwnerId,
  matchSleeperOwnerToUser,
} from '~/models/sleeperUser.server';
import {
  assignUnlinkedSurvivorEntry,
  getSleeperNamesOfMembers,
  getSurvivorPoolById,
  getSurvivorPoolWithEntries,
  setSurvivorInviteUrl,
} from '~/models/survivor.server';
import { getUser, getUsers } from '~/models/user.server';
import {
  getYahooUserByGuid,
  matchYahooGuidToUser,
} from '~/models/yahooUser.server';
import { authenticator, requireAdmin } from '~/services/auth.server';
import { createMemberSuggester } from '~/utils/names';

type ActionResult = {
  message: string;
  status: 'success' | 'warning' | 'error';
};

const zMember = z.string().min(1, 'Pick a member first.');

const STALE_MEMBER =
  'That member no longer exists or was merged. Reload the page and pick again.';

export const action = async ({ params, request }: ActionFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  const pool = await getSurvivorPoolById(params.poolId ?? '');
  if (!pool) throw new Response('Pool not found', { status: 404 });

  const formData = await request.formData();
  const result = (message: string, status: ActionResult['status']) =>
    typedjson<ActionResult>({ message, status });

  // Every match and assignment hands entries to a member, so a stale or
  // merged-away one is turned back first.
  const pickedMember = async () => {
    const parsed = zMember.safeParse(formData.get('userId'));
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const member = await getUser(parsed.data);
    if (!member || member.mergedIntoId) return { error: STALE_MEMBER };
    return { member };
  };

  switch (formData.get('_action')) {
    case 'syncPool': {
      try {
        const { unmatchedEntries } = await syncSleeperSurvivorPool(pool);
        return result(
          `Synced "${pool.name}".${
            unmatchedEntries > 0 ? ` ${unmatchedEntries} still unmatched.` : ''
          }`,
          unmatchedEntries > 0 ? 'warning' : 'success',
        );
      } catch (e) {
        return result(e instanceof Error ? e.message : 'Sync failed', 'error');
      }
    }

    case 'setInvite': {
      const inviteUrl = String(formData.get('inviteUrl') ?? '').trim();
      if (inviteUrl && !/^https:\/\/sleeper\.(com|app)\//.test(inviteUrl)) {
        return result(
          'An invite link starts with https://sleeper.com/.',
          'error',
        );
      }
      await setSurvivorInviteUrl(pool.id, inviteUrl);
      return result(
        inviteUrl ? 'Saved the invite link.' : 'Removed the invite link.',
        'success',
      );
    }

    case 'matchSleeper': {
      const sleeperOwnerID = String(formData.get('sleeperOwnerID') ?? '');
      if (!sleeperOwnerID)
        return result('No Sleeper account was submitted.', 'error');
      const { member, error } = await pickedMember();
      if (!member) return result(error, 'error');
      const existing = await getSleeperUserByOwnerId(sleeperOwnerID);
      if (existing) {
        return result(
          `That Sleeper account is already matched to ${existing.user.discordName}. Reload the page, and use the member's edit page to change it.`,
          'error',
        );
      }
      const { survivorEntriesUpdated } = await matchSleeperOwnerToUser({
        sleeperOwnerID,
        userId: member.id,
      });
      return result(
        `Matched to ${member.discordName} (${survivorEntriesUpdated} survivor ${
          survivorEntriesUpdated === 1 ? 'entry' : 'entries'
        } updated).`,
        'success',
      );
    }

    case 'matchYahoo': {
      const yahooGuid = String(formData.get('yahooGuid') ?? '');
      if (!yahooGuid) return result('No Yahoo account was submitted.', 'error');
      const { member, error } = await pickedMember();
      if (!member) return result(error, 'error');
      const existing = await getYahooUserByGuid(yahooGuid);
      if (existing) {
        return result(
          `That Yahoo account is already matched to ${existing.user.discordName}. Reload the page.`,
          'error',
        );
      }
      const { survivorEntriesUpdated } = await matchYahooGuidToUser({
        yahooGuid,
        userId: member.id,
      });
      return result(
        `Matched to ${member.discordName} (${survivorEntriesUpdated} ${
          survivorEntriesUpdated === 1 ? 'entry' : 'entries'
        } updated).`,
        'success',
      );
    }

    case 'assign': {
      const entryId = String(formData.get('entryId') ?? '');
      const { member, error } = await pickedMember();
      if (!member) return result(error, 'error');
      const updated = await assignUnlinkedSurvivorEntry({
        survivorPoolId: pool.id,
        entryId,
        userId: member.id,
      });
      return updated === 0
        ? result(
            'That entry has an account now, or is gone. Reload the page.',
            'error',
          )
        : result(`Assigned the entry to ${member.discordName}.`, 'success');
    }

    case 'unassign': {
      const cleared = await assignUnlinkedSurvivorEntry({
        survivorPoolId: pool.id,
        entryId: String(formData.get('entryId') ?? ''),
        userId: null,
      });
      return cleared === 0
        ? result(
            'That entry has an account now, or is gone. Reload the page.',
            'error',
          )
        : result('Unassigned the entry.', 'success');
    }
  }

  return result('No action taken', 'error');
};

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  const [pool, members, handles] = await Promise.all([
    getSurvivorPoolWithEntries(params.poolId ?? ''),
    getUsers(),
    getSleeperNamesOfMembers(),
  ]);
  if (!pool) throw new Response('Pool not found', { status: 404 });

  const suggestByDiscordName = createMemberSuggester(members, {
    lookAlike: pool.source === 'SLEEPER',
  });

  // Furthest first; within a week, alphabetically.
  const entries = [...pool.entries].sort(
    (a, b) =>
      b.survivedWeek - a.survivedWeek ||
      (a.user?.discordName ?? a.displayName ?? '').localeCompare(
        b.user?.discordName ?? b.displayName ?? '',
      ),
  );

  return typedjson({
    pool: {
      id: pool.id,
      name: pool.name,
      year: pool.year,
      source: pool.source,
      externalId: pool.externalId,
      startWeek: pool.startWeek,
      inviteUrl: pool.inviteUrl,
      isComplete: pool.isComplete,
      lastSyncedAt: pool.lastSyncedAt,
    },
    entries: entries.map(entry => ({
      id: entry.id,
      displayName: entry.displayName,
      entryName: entry.entryName,
      sleeperOwnerId: entry.sleeperOwnerId,
      yahooGuid: entry.yahooGuid,
      member: entry.user,
      eliminatedWeek: entry.eliminatedWeek,
      survivedWeek: entry.survivedWeek,
      finish: entry.finish,
      picks: entry.picks.length,
      suggestedMemberId: entry.user
        ? undefined
        : (pool.source === 'YAHOO' &&
            suggestFromSleeperHandles(
              [entry.displayName, entry.entryName],
              handles,
            )) ||
          suggestByDiscordName(entry.displayName, entry.entryName),
    })),
    members: members.map(toSelectableMember),
  });
};

export default function AdminSurvivorPool() {
  const { pool, entries, members } = useTypedLoaderData<typeof loader>();
  const actionData = useTypedActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state !== 'idle';

  const unmatched = entries.filter(entry => !entry.member);
  const isYahoo = pool.source === 'YAHOO';

  return (
    <div>
      <p className='text-sm'>
        <Link to='/admin/survivor'>← Survivor pools</Link>
      </p>
      <h2>
        {pool.name} ({pool.year})
      </h2>
      <p className='text-sm'>
        {isYahoo
          ? 'Played on Yahoo; loaded from the history file that ships with the site.'
          : `Sleeper league ${pool.externalId}.`}{' '}
        Picks from week {pool.startWeek}.{' '}
        {pool.isComplete ? 'The winner is decided.' : 'Still running.'}{' '}
        {!isYahoo &&
          `Last synced ${
            pool.lastSyncedAt ? pool.lastSyncedAt.toLocaleString() : 'never'
          }.`}
      </p>

      {actionData?.message && (
        <Alert message={actionData.message} status={actionData.status} />
      )}

      {!isYahoo && (
        <section className='mb-8'>
          <Form method='POST' className='mb-4'>
            <Button
              type='submit'
              name='_action'
              value='syncPool'
              disabled={isSubmitting}
            >
              Resync From Sleeper
            </Button>
          </Form>
          <Form
            key={pool.inviteUrl ?? ''}
            method='POST'
            className='flex flex-wrap items-end gap-2'
          >
            <div>
              <label htmlFor='inviteUrl' className='block text-sm'>
                Invite Link
              </label>
              <input
                id='inviteUrl'
                name='inviteUrl'
                type='text'
                defaultValue={pool.inviteUrl ?? ''}
                className='w-96 max-w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-white'
                placeholder='https://sleeper.com/i/…'
              />
            </div>
            <Button
              type='submit'
              name='_action'
              value='setInvite'
              disabled={isSubmitting}
            >
              Save
            </Button>
          </Form>
          <p className='text-xs opacity-75'>
            Shown on the Survivor page while the pool is still running. Leave it
            empty to hide it.
          </p>
        </section>
      )}

      {unmatched.length > 0 && (
        <section className='mb-8'>
          <h3>Unmatched Entries</h3>
          <p className='text-sm'>
            Matching a {isYahoo ? 'Yahoo' : 'Sleeper'} account here links it
            everywhere on the site, not just in this pool. An entry with no
            account (its owner left, or Yahoo closed the account) is assigned to
            a member for this pool only.
          </p>
          <table className='w-full'>
            <thead>
              <tr>
                <th className='text-left'>Entry</th>
                <th className='text-left'>Member</th>
              </tr>
            </thead>
            <tbody>
              {unmatched.map(entry => (
                <tr key={entry.id}>
                  <td>
                    {entry.displayName ?? 'Unknown'}
                    {entry.entryName && (
                      <div className='text-xs opacity-75'>
                        {entry.entryName}
                      </div>
                    )}
                    <div className='font-mono text-xs opacity-60'>
                      {entry.sleeperOwnerId ?? entry.yahooGuid ?? 'No account'}
                    </div>
                  </td>
                  <td className='not-prose'>
                    <Form method='POST' className='flex items-center gap-2'>
                      {entry.sleeperOwnerId ? (
                        <input
                          type='hidden'
                          name='sleeperOwnerID'
                          value={entry.sleeperOwnerId}
                        />
                      ) : entry.yahooGuid ? (
                        <input
                          type='hidden'
                          name='yahooGuid'
                          value={entry.yahooGuid}
                        />
                      ) : (
                        <input type='hidden' name='entryId' value={entry.id} />
                      )}
                      <MemberSelect
                        name='userId'
                        members={members}
                        defaultValue={entry.suggestedMemberId}
                      />
                      <Button
                        type='submit'
                        name='_action'
                        value={
                          entry.sleeperOwnerId
                            ? 'matchSleeper'
                            : entry.yahooGuid
                            ? 'matchYahoo'
                            : 'assign'
                        }
                        disabled={isSubmitting}
                      >
                        {entry.sleeperOwnerId || entry.yahooGuid
                          ? 'Match'
                          : 'Assign'}
                      </Button>
                    </Form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section>
        <h3>Entries</h3>
        <table className='w-full'>
          <thead>
            <tr>
              <th className='text-left'>Place</th>
              <th className='text-left'>Entry</th>
              <th className='text-left'>Out</th>
              <th className='text-left'>Picks</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(entry => (
              <tr key={entry.id}>
                <td>
                  {entry.finish === 1
                    ? 'Winner'
                    : entry.finish
                    ? entry.finish
                    : entry.eliminatedWeek
                    ? '—'
                    : 'Alive'}
                </td>
                <td>
                  {entry.member?.discordName ?? entry.displayName ?? 'Unknown'}
                  {entry.member &&
                    entry.displayName &&
                    entry.displayName !== entry.member.discordName && (
                      <div className='text-xs opacity-75'>
                        {entry.displayName} on {isYahoo ? 'Yahoo' : 'Sleeper'}
                      </div>
                    )}
                  {entry.member &&
                    !entry.sleeperOwnerId &&
                    !entry.yahooGuid && (
                      <Form
                        method='POST'
                        className='not-prose flex items-center gap-2 text-xs opacity-75'
                      >
                        Assigned by hand
                        <input type='hidden' name='entryId' value={entry.id} />
                        <button
                          type='submit'
                          name='_action'
                          value='unassign'
                          disabled={isSubmitting}
                          className='underline'
                        >
                          Unassign
                        </button>
                      </Form>
                    )}
                </td>
                <td>
                  {entry.eliminatedWeek ? `Week ${entry.eliminatedWeek}` : '—'}
                </td>
                <td>{entry.picks}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
