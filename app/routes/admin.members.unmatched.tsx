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
import { ExternalLink, Link } from '~/components/ui/link';
import { Section } from '~/components/ui/section';
import { Table } from '~/components/ui/table';
import { getSleeperLeagueUsers } from '~/libs/league-sync.server';
import { getUnmatchedTeams } from '~/libs/members/unmatched.server';
import { getCurrentSeason } from '~/models/season.server';
import {
  getSleeperUserByOwnerId,
  matchSleeperOwnerToUser,
} from '~/models/sleeperUser.server';
import { getUser, getUsers } from '~/models/user.server';
import { authenticator, requireAdmin } from '~/services/auth.server';
import { createMemberSuggester } from '~/utils/names';

const zFormData = z.object({
  sleeperOwnerID: z.string().min(1, 'No Sleeper owner ID was submitted.'),
  userId: z.string().min(1, 'Pick a member to match this Sleeper user to.'),
});

export const action = async ({ request }: ActionFunctionArgs) => {
  // The admin layout only requires an editor, and layout loaders do not guard
  // child actions, so this has to check for admin itself.
  const currentUser = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(currentUser);

  const formData = await request.formData();
  const parsedFormData = zFormData.safeParse({
    sleeperOwnerID: formData.get('sleeperOwnerID'),
    userId: formData.get('userId'),
  });

  if (!parsedFormData.success) {
    return typedjson({
      message: parsedFormData.error.issues[0].message,
      status: 'error' as const,
    });
  }

  const { sleeperOwnerID, userId } = parsedFormData.data;

  const member = await getUser(userId);
  if (!member) {
    return typedjson({
      message: 'Member not found.',
      status: 'error' as const,
    });
  }

  // The picker is built from live members only, so a merged-away one here came
  // from a form loaded before the merge. Matching would backfill every one of
  // that owner's teams onto an account nobody can log into.
  if (member.mergedIntoId) {
    return typedjson({
      message: `${member.discordName} was merged into another member. Reload the page and pick the member they were merged into.`,
      status: 'error' as const,
    });
  }

  // This page only ever renders owners with no mapping, so a submit for one
  // that is already mapped came from a stale form - a second tab, the back
  // button, or another admin getting there first. Re-pointing it would move
  // every one of that owner's teams, so say something instead of doing it.
  const existingMatch = await getSleeperUserByOwnerId(sleeperOwnerID);
  if (existingMatch) {
    return typedjson({
      message: `Sleeper ID ${sleeperOwnerID} is already matched to ${existingMatch.user.discordName}. Reload the page, and use the member's edit page if you need to change it.`,
      status: 'error' as const,
    });
  }

  const { teamsUpdated } = await matchSleeperOwnerToUser({
    sleeperOwnerID,
    userId,
  });

  return typedjson({
    message: `Sleeper ID ${sleeperOwnerID} is now matched to ${
      member.discordName
    } (${teamsUpdated} team${teamsUpdated === 1 ? '' : 's'} updated).`,
    status: 'success' as const,
  });
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const currentUser = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(currentUser);

  const currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    throw new Error('No active season currently');
  }

  const [leagues, members] = await Promise.all([
    getUnmatchedTeams(currentSeason.year),
    getUsers(),
  ]);

  // A Discord name that belongs to two members can't be suggested, since there
  // is no way to tell which of them the Sleeper account is.
  const suggestMemberId = createMemberSuggester(members);

  const leaguesWithUnmatched = await Promise.all(
    leagues.map(async ({ league, unmatchedTeams }) => {
      // Team only stores the owner ID, so Sleeper has to tell us who that is.
      // One league failing to answer shouldn't take down the whole page.
      let sleeperUsers = null;
      let lookupError: string | null = null;
      if (unmatchedTeams.length > 0) {
        try {
          sleeperUsers = await getSleeperLeagueUsers(league.sleeperLeagueId);
        } catch (error) {
          lookupError =
            error instanceof Error ? error.message : 'Unknown Sleeper error';
        }
      }

      return {
        id: league.id,
        name: league.name,
        tier: league.tier,
        sleeperLeagueId: league.sleeperLeagueId,
        teamCount: league.teams.length,
        lookupError,
        unmatchedTeams: unmatchedTeams.map(team => {
          const sleeperUser = sleeperUsers?.get(team.sleeperOwnerId);
          const username = sleeperUser?.username ?? null;
          const displayName = sleeperUser?.displayName ?? null;

          return {
            teamId: team.id,
            sleeperOwnerId: team.sleeperOwnerId,
            username,
            displayName,
            teamName: sleeperUser?.teamName ?? null,
            suggestedMemberId: suggestMemberId(username, displayName),
          };
        }),
      };
    }),
  );

  return typedjson({
    year: currentSeason.year,
    leagues: leaguesWithUnmatched,
    members: members.map(toSelectableMember),
    totalUnmatched: leaguesWithUnmatched.reduce(
      (total, league) => total + league.unmatchedTeams.length,
      0,
    ),
  });
};

export default function UnmatchedSleeperUsers() {
  const { year, leagues, members, totalUnmatched } =
    useTypedLoaderData<typeof loader>();
  const actionData = useTypedActionData<typeof action>();
  const navigation = useNavigation();

  return (
    <Section
      title={`Unmatched Sleeper Users (${year})`}
      description={
        <>
          Every team in this year's leagues whose Sleeper account isn't tied to
          a Discord member yet. Matching here also backfills every team that
          Sleeper account owns, so there's no need to resync the league
          afterwards. If the person has never logged into the site, they won't
          be in the list of members and you'll need to{' '}
          <Link to='/admin/members/add'>add them manually</Link> first.
        </>
      }
    >
      {actionData?.message && (
        <Alert
          message={actionData.message}
          status={actionData.status}
          className='mb-6'
        />
      )}
      {totalUnmatched === 0 && (
        <p className='text-muted-foreground'>
          Every team in {year} is matched to a Discord member.
        </p>
      )}
      {leagues.map(league => (
        <Section
          key={league.id}
          as='h3'
          title={`${league.name} (Tier ${league.tier})`}
        >
          {league.lookupError && (
            <Alert
              message={`Could not load Sleeper usernames for this league: ${league.lookupError}`}
              status='error'
              className='mb-6'
            />
          )}
          {league.unmatchedTeams.length === 0 ? (
            <p className='text-muted-foreground'>
              All {league.teamCount} teams are matched.
              {league.teamCount < 12 &&
                ' (This league has fewer than 12 teams synced.)'}
            </p>
          ) : (
            <Table
              headers={[
                'Sleeper User',
                'Team Name',
                'Sleeper Owner ID',
                'Discord Member',
              ]}
              primaryColumns={[3]}
            >
              {league.unmatchedTeams.map(team => (
                <tr key={team.teamId}>
                  <td>
                    {team.username ? (
                      <ExternalLink
                        href={`https://sleeper.com/user/${team.username}`}
                      >
                        {team.displayName ?? team.username}
                      </ExternalLink>
                    ) : (
                      team.displayName ?? 'Unknown'
                    )}
                    {team.displayName &&
                      team.username &&
                      team.displayName !== team.username && (
                        <div className='text-sm text-muted-foreground'>
                          @{team.username}
                        </div>
                      )}
                  </td>
                  <td>{team.teamName ?? '-'}</td>
                  <td className='font-mono text-sm'>{team.sleeperOwnerId}</td>
                  <td>
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
                        disabled={navigation.state !== 'idle'}
                      >
                        Match
                      </Button>
                    </Form>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Section>
      ))}
    </Section>
  );
}
