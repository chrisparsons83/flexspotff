import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form, useNavigation } from '@remix-run/react';
import {
  typedjson,
  useTypedActionData,
  useTypedLoaderData,
} from 'remix-typedjson';
import { z } from 'zod';
import Alert from '~/components/ui/Alert';
import MemberSelect, { toSelectableMember } from '~/components/ui/MemberSelect';
import { Button } from '~/components/ui/button';
import { Field } from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { Link } from '~/components/ui/link';
import { Section } from '~/components/ui/section';
import { Table } from '~/components/ui/table';
import { prisma } from '~/db.server';
import { suggestFromSleeperHandles } from '~/libs/survivor/suggest';
import {
  addSleeperSurvivorPool,
  importYahooHistory,
  syncSleeperSurvivorPool,
} from '~/libs/survivor/sync.server';
import {
  deleteSurvivorPool,
  getSleeperNamesOfMembers,
  getSurvivorPoolById,
  getSurvivorPoolsForAdmin,
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

const unmatchedNote = (count: number) =>
  count > 0
    ? ` ${count} ${
        count === 1 ? 'entry is' : 'entries are'
      } not matched to a member yet.`
    : '';

const zMatchYahoo = z.object({
  yahooGuid: z.string().min(1, 'No Yahoo account was submitted.'),
  userId: z.string().min(1, 'Pick a member to match this Yahoo account to.'),
});

export const action = async ({ request }: ActionFunctionArgs) => {
  // The admin layout only requires an editor, and layout loaders do not guard
  // child actions, so this has to check for admin itself.
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  const formData = await request.formData();

  try {
    switch (formData.get('_action')) {
      case 'addPool': {
        const sleeperUrl = formData.get('sleeperUrl');
        if (typeof sleeperUrl !== 'string' || sleeperUrl.trim() === '') {
          return typedjson<ActionResult>({
            message: 'Paste the Sleeper league URL or invite link.',
            status: 'error',
          });
        }
        const { pool, warning, unmatchedEntries } =
          await addSleeperSurvivorPool(sleeperUrl);
        return typedjson<ActionResult>({
          message: warning
            ? `Added "${pool.name}" to ${pool.year}. ${warning}`
            : `Added "${pool.name}" to ${
                pool.year
              } and synced it.${unmatchedNote(unmatchedEntries)}`,
          status: warning || unmatchedEntries > 0 ? 'warning' : 'success',
        });
      }

      case 'importYahoo': {
        const { pools, unmatchedEntries } = await importYahooHistory();
        return typedjson<ActionResult>({
          message: `Loaded ${pools} Yahoo pools.${unmatchedNote(
            unmatchedEntries,
          )}`,
          status: unmatchedEntries > 0 ? 'warning' : 'success',
        });
      }

      case 'syncPool': {
        const poolId = formData.get('poolId');
        if (typeof poolId !== 'string') throw new Error('Missing pool');
        const pool = await getSurvivorPoolById(poolId);
        if (!pool) throw new Error('Pool not found');
        const { unmatchedEntries } = await syncSleeperSurvivorPool(pool);
        return typedjson<ActionResult>({
          message: `Synced "${pool.name}".${unmatchedNote(unmatchedEntries)}`,
          status: unmatchedEntries > 0 ? 'warning' : 'success',
        });
      }

      case 'deletePool': {
        const poolId = formData.get('poolId');
        if (typeof poolId !== 'string') throw new Error('Missing pool');
        const pool = await deleteSurvivorPool(poolId);
        return typedjson<ActionResult>({
          message: `Deleted "${pool.name}".`,
          status: 'success',
        });
      }

      case 'matchYahoo': {
        const parsed = zMatchYahoo.safeParse({
          yahooGuid: formData.get('yahooGuid'),
          userId: formData.get('userId'),
        });
        if (!parsed.success) {
          return typedjson<ActionResult>({
            message: parsed.error.issues[0].message,
            status: 'error',
          });
        }
        const { yahooGuid, userId } = parsed.data;

        const member = await getUser(userId);
        if (!member || member.mergedIntoId) {
          return typedjson<ActionResult>({
            message:
              'That member no longer exists or was merged. Reload the page and pick again.',
            status: 'error',
          });
        }
        const existing = await getYahooUserByGuid(yahooGuid);
        if (existing) {
          return typedjson<ActionResult>({
            message: `That Yahoo account is already matched to ${existing.user.discordName}. Reload the page.`,
            status: 'error',
          });
        }

        const { survivorEntriesUpdated } = await matchYahooGuidToUser({
          yahooGuid,
          userId,
        });
        return typedjson<ActionResult>({
          message: `Matched to ${
            member.discordName
          } (${survivorEntriesUpdated} ${
            survivorEntriesUpdated === 1 ? 'entry' : 'entries'
          } updated).`,
          status: 'success',
        });
      }
    }
  } catch (e) {
    return typedjson<ActionResult>({
      message: e instanceof Error ? e.message : 'Something went wrong',
      status: 'error',
    });
  }

  return typedjson<ActionResult>({
    message: 'No action taken',
    status: 'error',
  });
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  const [pools, unmatchedYahoo, members, handles] = await Promise.all([
    getSurvivorPoolsForAdmin(),
    prisma.survivorEntry.findMany({
      where: { yahooGuid: { not: null }, userId: null },
      select: {
        yahooGuid: true,
        displayName: true,
        entryName: true,
        pool: { select: { year: true, name: true } },
      },
      orderBy: { pool: { year: 'asc' } },
    }),
    getUsers(),
    getSleeperNamesOfMembers(),
  ]);

  // One row per Yahoo account rather than per entry: matching an account
  // takes every pool it played.
  const accounts = new Map<
    string,
    { nicknames: Set<string>; entryNames: Set<string>; pools: string[] }
  >();
  for (const entry of unmatchedYahoo) {
    const account = accounts.get(entry.yahooGuid!) ?? {
      nicknames: new Set(),
      entryNames: new Set(),
      pools: [],
    };
    if (entry.displayName) account.nicknames.add(entry.displayName);
    if (entry.entryName) account.entryNames.add(entry.entryName);
    account.pools.push(`${entry.pool.year} ${entry.pool.name}`);
    accounts.set(entry.yahooGuid!, account);
  }

  const suggestByDiscordName = createMemberSuggester(members);

  return typedjson({
    pools: pools.map(pool => ({
      id: pool.id,
      name: pool.name,
      year: pool.year,
      source: pool.source,
      externalId: pool.externalId,
      startWeek: pool.startWeek,
      isComplete: pool.isComplete,
      lastSyncedAt: pool.lastSyncedAt,
      entryCount: pool.entries.length,
      unmatchedEntries: pool.entries.filter(entry => !entry.userId).length,
    })),
    yahooAccounts: [...accounts].map(([yahooGuid, account]) => {
      const nicknames = [...account.nicknames];
      const entryNames = [...account.entryNames];
      return {
        yahooGuid,
        nicknames,
        entryNames,
        pools: account.pools,
        suggestedMemberId:
          suggestFromSleeperHandles([...nicknames, ...entryNames], handles) ||
          suggestByDiscordName(...nicknames),
      };
    }),
    members: members.map(toSelectableMember),
  });
};

export default function AdminSurvivorIndex() {
  const { pools, yahooAccounts, members } = useTypedLoaderData<typeof loader>();
  const actionData = useTypedActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state !== 'idle';
  const submitting = (action: string) =>
    isSubmitting && navigation.formData?.get('_action') === action;

  const years = [...new Set(pools.map(pool => pool.year))];
  const hasYahoo = pools.some(pool => pool.source === 'YAHOO');

  return (
    <Section title='Survivor pools'>
      {actionData?.message && (
        <Alert
          message={actionData.message}
          status={actionData.status}
          className='mb-6'
        />
      )}

      <Section
        as='h3'
        title='Add Sleeper pool'
        description="Paste the pool's Sleeper league URL or its invite link. The season and name come from Sleeper, and an invite link is kept to show on the Games page. Pools from the current season then sync every hour."
      >
        <Form
          key={actionData?.message}
          method='POST'
          className='flex flex-wrap items-end gap-3'
        >
          <Field label='Sleeper URL or invite link' className='w-full sm:w-96'>
            <Input
              name='sleeperUrl'
              placeholder='https://sleeper.com/i/0NLXm3e7a1Pk5'
            />
          </Field>
          <Button
            type='submit'
            name='_action'
            value='addPool'
            disabled={isSubmitting}
          >
            {submitting('addPool') ? 'Adding…' : 'Add pool'}
          </Button>
        </Form>
      </Section>

      <Section
        as='h3'
        title='Yahoo history'
        description='The five Yahoo Survival Football pools from 2022 and 2023 ship with the site. Loading them again rewrites them from that file and keeps every member already matched.'
      >
        <Form method='POST'>
          <Button
            type='submit'
            name='_action'
            value='importYahoo'
            disabled={isSubmitting}
          >
            {submitting('importYahoo')
              ? 'Loading…'
              : hasYahoo
              ? 'Reload Yahoo pools'
              : 'Load Yahoo pools'}
          </Button>
        </Form>
      </Section>

      {yahooAccounts.length > 0 && (
        <Section
          as='h3'
          title='Unmatched Yahoo accounts'
          description="Matching an account gives the member every Yahoo pool it played. Yahoo nicknames are mostly first names, so the pick set names are often the better clue. A suggestion comes from a member's Sleeper handle turning up in one of them."
        >
          <Table headers={['Yahoo account', 'Member']}>
            {yahooAccounts.map(account => (
              <tr key={account.yahooGuid}>
                <td>
                  {account.nicknames.join(', ') || 'No nickname'}
                  <div className='text-sm text-muted-foreground'>
                    {account.entryNames.join(', ')}
                  </div>
                  <div className='text-sm text-muted-foreground'>
                    {account.pools.join(', ')}
                  </div>
                </td>
                <td>
                  <Form method='POST' className='flex items-center gap-2'>
                    <input
                      type='hidden'
                      name='yahooGuid'
                      value={account.yahooGuid}
                    />
                    <MemberSelect
                      name='userId'
                      members={members}
                      defaultValue={account.suggestedMemberId}
                    />
                    <Button
                      type='submit'
                      name='_action'
                      value='matchYahoo'
                      disabled={isSubmitting}
                    >
                      Match
                    </Button>
                  </Form>
                </td>
              </tr>
            ))}
          </Table>
        </Section>
      )}

      {pools.length === 0 && (
        <p className='mt-16 text-muted-foreground'>
          No survivor pools added yet.
        </p>
      )}

      {years.map(year => (
        <Section key={year} as='h3' title={year}>
          <Table headers={['Pool', 'Status', 'Members', 'Last synced', '']}>
            {pools
              .filter(pool => pool.year === year)
              .map(pool => (
                <tr key={pool.id}>
                  <td>
                    <Link to={pool.id}>{pool.name}</Link>
                    <div className='font-mono text-sm text-muted-foreground'>
                      {pool.source === 'YAHOO' ? 'Yahoo' : 'Sleeper'}{' '}
                      {pool.externalId}
                    </div>
                  </td>
                  <td>
                    {pool.isComplete ? 'Decided' : 'Running'}
                    <div className='text-sm text-muted-foreground'>
                      From week {pool.startWeek}
                    </div>
                  </td>
                  <td>
                    {pool.unmatchedEntries > 0 ? (
                      <Link to={pool.id} className='text-warning'>
                        {pool.unmatchedEntries} of {pool.entryCount} unmatched
                      </Link>
                    ) : (
                      `All ${pool.entryCount} matched`
                    )}
                  </td>
                  <td className='text-sm'>
                    {pool.lastSyncedAt
                      ? pool.lastSyncedAt.toLocaleString()
                      : 'Never'}
                  </td>
                  <td>
                    <div className='flex gap-2'>
                      {pool.source === 'SLEEPER' && (
                        <Form method='POST'>
                          <input type='hidden' name='poolId' value={pool.id} />
                          <Button
                            type='submit'
                            name='_action'
                            value='syncPool'
                            disabled={isSubmitting}
                          >
                            Sync
                          </Button>
                        </Form>
                      )}
                      <Form
                        method='POST'
                        onSubmit={e => {
                          if (
                            !window.confirm(
                              `Delete "${pool.name}" (${pool.year})? ${
                                pool.source === 'YAHOO'
                                  ? 'Reloading the Yahoo pools brings it back.'
                                  : 'It can be added again from its Sleeper URL.'
                              }`,
                            )
                          ) {
                            e.preventDefault();
                          }
                        }}
                      >
                        <input type='hidden' name='poolId' value={pool.id} />
                        <Button
                          type='submit'
                          name='_action'
                          value='deletePool'
                          disabled={isSubmitting}
                        >
                          Delete
                        </Button>
                      </Form>
                    </div>
                  </td>
                </tr>
              ))}
          </Table>
        </Section>
      ))}
    </Section>
  );
}
