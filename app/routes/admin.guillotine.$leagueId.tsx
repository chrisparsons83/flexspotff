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
import { syncGuillotineLeague } from '~/libs/guillotine/sync.server';
import {
  assignOwnerlessGuillotineTeam,
  getGuillotineLeagueById,
  getGuillotineLeagueWithTeams,
} from '~/models/guillotine.server';
import {
  getSleeperUserByOwnerId,
  matchSleeperOwnerToUser,
} from '~/models/sleeperUser.server';
import { getUser, getUsers } from '~/models/user.server';
import { authenticator, requireAdmin } from '~/services/auth.server';
import { createMemberSuggester } from '~/utils/names';

type ActionResult = {
  message: string;
  status: 'success' | 'warning' | 'error';
  warnings?: string[];
};

const zMatch = z.object({
  sleeperOwnerID: z.string().min(1, 'No Sleeper owner ID was submitted.'),
  userId: z.string().min(1, 'Pick a member to match this Sleeper user to.'),
});

const zAssign = z.object({
  teamId: z.string().min(1, 'No team was submitted.'),
  userId: z.string().min(1, 'Pick a member to assign this roster to.'),
});

export const action = async ({ params, request }: ActionFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  const league = await getGuillotineLeagueById(params.leagueId ?? '');
  if (!league) throw new Response('League not found', { status: 404 });

  const formData = await request.formData();

  switch (formData.get('_action')) {
    case 'syncLeague': {
      try {
        const { warnings, unmatchedTeams } = await syncGuillotineLeague(league);
        return typedjson<ActionResult>({
          message: `Synced "${league.name}".${
            unmatchedTeams > 0
              ? ` ${unmatchedTeams} team${
                  unmatchedTeams === 1 ? ' is' : 's are'
                } still unmatched.`
              : ''
          }`,
          status: warnings.length > 0 ? 'warning' : 'success',
          warnings,
        });
      } catch (e) {
        return typedjson<ActionResult>({
          message: e instanceof Error ? e.message : 'Sync failed',
          status: 'error',
        });
      }
    }

    case 'match': {
      const parsed = zMatch.safeParse({
        sleeperOwnerID: formData.get('sleeperOwnerID'),
        userId: formData.get('userId'),
      });
      if (!parsed.success) {
        return typedjson<ActionResult>({
          message: parsed.error.issues[0].message,
          status: 'error',
        });
      }
      const { sleeperOwnerID, userId } = parsed.data;

      // The same guards as the Unmatched Sleeper Users page: a merged-away
      // member would take teams nobody can log in to see, and an owner that is
      // already matched means this form is stale.
      const member = await getUser(userId);
      if (!member || member.mergedIntoId) {
        return typedjson<ActionResult>({
          message:
            'That member no longer exists or was merged. Reload the page and pick again.',
          status: 'error',
        });
      }
      const existing = await getSleeperUserByOwnerId(sleeperOwnerID);
      if (existing) {
        return typedjson<ActionResult>({
          message: `That Sleeper account is already matched to ${existing.user.discordName}. Reload the page, and use the member's edit page to change it.`,
          status: 'error',
        });
      }

      const { guillotineTeamsUpdated } = await matchSleeperOwnerToUser({
        sleeperOwnerID,
        userId,
      });
      return typedjson<ActionResult>({
        message: `Matched to ${
          member.discordName
        } (${guillotineTeamsUpdated} guillotine team${
          guillotineTeamsUpdated === 1 ? '' : 's'
        } updated).`,
        status: 'success',
      });
    }

    case 'assign': {
      const parsed = zAssign.safeParse({
        teamId: formData.get('teamId'),
        userId: formData.get('userId'),
      });
      if (!parsed.success) {
        return typedjson<ActionResult>({
          message: parsed.error.issues[0].message,
          status: 'error',
        });
      }
      const { teamId, userId } = parsed.data;

      const member = await getUser(userId);
      if (!member || member.mergedIntoId) {
        return typedjson<ActionResult>({
          message:
            'That member no longer exists or was merged. Reload the page and pick again.',
          status: 'error',
        });
      }
      const updated = await assignOwnerlessGuillotineTeam({
        guillotineLeagueId: league.id,
        teamId,
        userId,
      });
      if (updated === 0) {
        return typedjson<ActionResult>({
          message:
            'That roster has a Sleeper owner now, or is gone. Reload the page.',
          status: 'error',
        });
      }
      return typedjson<ActionResult>({
        message: `Assigned the roster to ${member.discordName}.`,
        status: 'success',
      });
    }

    case 'unassign': {
      const teamId = formData.get('teamId');
      if (typeof teamId !== 'string' || !teamId) {
        return typedjson<ActionResult>({
          message: 'No team was submitted.',
          status: 'error',
        });
      }
      const cleared = await assignOwnerlessGuillotineTeam({
        guillotineLeagueId: league.id,
        teamId,
        userId: null,
      });
      if (cleared === 0) {
        return typedjson<ActionResult>({
          message:
            'That roster has a Sleeper owner now, or is gone. Reload the page.',
          status: 'error',
        });
      }
      return typedjson<ActionResult>({
        message: 'Unassigned the roster.',
        status: 'success',
      });
    }
  }

  return typedjson<ActionResult>({
    message: 'No action taken',
    status: 'error',
  });
};

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  const [league, members] = await Promise.all([
    getGuillotineLeagueWithTeams(params.leagueId ?? ''),
    getUsers(),
  ]);
  if (!league) throw new Response('League not found', { status: 404 });

  const suggestMemberId = createMemberSuggester(members);

  // Survivors first, then everyone else in the order they finished. A team
  // with no chop week and no finish is still alive.
  const teams = [...league.teams].sort(
    (a, b) =>
      (a.finish ?? 0) - (b.finish ?? 0) ||
      (a.draftSlot ?? 99) - (b.draftSlot ?? 99),
  );

  return typedjson({
    league: {
      id: league.id,
      name: league.name,
      year: league.season.year,
      sleeperLeagueId: league.sleeperLeagueId,
      format: league.format,
      isComplete: league.isComplete,
      lastScoredWeek: league.lastScoredWeek,
      lastSyncedAt: league.lastSyncedAt,
    },
    teams: teams.map(team => ({
      id: team.id,
      rosterId: team.rosterId,
      sleeperOwnerId: team.sleeperOwnerId,
      sleeperDisplayName: team.sleeperDisplayName,
      member: team.user,
      draftSlot: team.draftSlot,
      choppedWeek: team.choppedWeek,
      finish: team.finish,
      suggestedMemberId: team.user
        ? undefined
        : suggestMemberId(team.sleeperDisplayName),
    })),
    members: members.map(toSelectableMember),
  });
};

const placeLabel = (team: {
  finish: number | null;
  choppedWeek: number | null;
}) =>
  team.finish === 1 ? 'Champion' : team.finish ? `${team.finish}` : 'Alive';

export default function AdminGuillotineLeague() {
  const { league, teams, members } = useTypedLoaderData<typeof loader>();
  const actionData = useTypedActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state !== 'idle';

  const unmatched = teams.filter(team => !team.member);

  return (
    <div>
      <p className='text-sm'>
        <Link to='/admin/guillotine'>← Guillotine leagues</Link>
      </p>
      <h2>
        {league.name} ({league.year})
      </h2>
      <p className='text-sm'>
        {league.format === 'NATIVE'
          ? "Sleeper's own guillotine format: chops are read from each roster's elimination week."
          : 'Chopped by hand: a chop is read from the week the commissioner emptied the roster.'}{' '}
        {league.isComplete
          ? 'The season is complete.'
          : league.lastScoredWeek > 0
          ? `Scored through week ${league.lastScoredWeek}.`
          : 'No weeks scored yet.'}{' '}
        Last synced{' '}
        {league.lastSyncedAt ? league.lastSyncedAt.toLocaleString() : 'never'}.
      </p>

      {actionData?.message && (
        <Alert message={actionData.message} status={actionData.status} />
      )}
      {actionData?.warnings?.map(warning => (
        <Alert key={warning} message={warning} status='warning' />
      ))}

      <Form method='POST' className='mb-6'>
        <Button
          type='submit'
          name='_action'
          value='syncLeague'
          disabled={isSubmitting}
        >
          Resync From Sleeper
        </Button>
      </Form>

      {unmatched.length > 0 && (
        <section className='mb-8'>
          <h3>Unmatched Teams</h3>
          <p className='text-sm'>
            These Sleeper accounts aren't tied to a member yet. Matching one
            here links it everywhere on the site, not just in this league. A
            roster Sleeper has no owner for is assigned to a member for this
            league only, and resyncing keeps it.
          </p>
          <table className='w-full'>
            <thead>
              <tr>
                <th className='text-left'>Sleeper User</th>
                <th className='text-left'>Member</th>
              </tr>
            </thead>
            <tbody>
              {unmatched.map(team => (
                <tr key={team.id}>
                  <td>
                    {team.sleeperDisplayName ?? 'Unknown'}
                    <div className='font-mono text-xs opacity-75'>
                      {team.sleeperOwnerId ??
                        `Roster ${team.rosterId}, no owner`}
                    </div>
                  </td>
                  <td className='not-prose'>
                    {team.sleeperOwnerId ? (
                      <Form method='POST' className='flex items-center gap-2'>
                        <input
                          type='hidden'
                          name='sleeperOwnerID'
                          value={team.sleeperOwnerId}
                        />
                        <MemberSelect
                          name='userId'
                          members={members}
                          defaultValue={team.suggestedMemberId}
                        />
                        <Button
                          type='submit'
                          name='_action'
                          value='match'
                          disabled={isSubmitting}
                        >
                          Match
                        </Button>
                      </Form>
                    ) : (
                      <Form method='POST' className='flex items-center gap-2'>
                        <input type='hidden' name='teamId' value={team.id} />
                        <MemberSelect name='userId' members={members} />
                        <Button
                          type='submit'
                          name='_action'
                          value='assign'
                          disabled={isSubmitting}
                        >
                          Assign
                        </Button>
                      </Form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section>
        <h3>Chop Order</h3>
        <table className='w-full'>
          <thead>
            <tr>
              <th className='text-left'>Place</th>
              <th className='text-left'>Team</th>
              <th className='text-left'>Chopped</th>
              <th className='text-left'>Draft Slot</th>
            </tr>
          </thead>
          <tbody>
            {teams.map(team => (
              <tr key={team.id}>
                <td>{placeLabel(team)}</td>
                <td>
                  {team.member?.discordName ??
                    team.sleeperDisplayName ??
                    `Roster ${team.rosterId}`}
                  {team.member &&
                    team.sleeperDisplayName &&
                    team.sleeperDisplayName !== team.member.discordName && (
                      <div className='text-xs opacity-75'>
                        {team.sleeperDisplayName} on Sleeper
                      </div>
                    )}
                  {team.member && !team.sleeperOwnerId && (
                    <Form
                      method='POST'
                      className='not-prose flex items-center gap-2 text-xs opacity-75'
                    >
                      Assigned by hand
                      <input type='hidden' name='teamId' value={team.id} />
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
                <td>{team.choppedWeek ? `Week ${team.choppedWeek}` : '—'}</td>
                <td>{team.draftSlot ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
