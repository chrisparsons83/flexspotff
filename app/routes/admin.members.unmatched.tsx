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
import { getSleeperLeagueUsers } from '~/libs/league-sync.server';
import { getLeaguesByYear } from '~/models/league.server';
import { getCurrentSeason } from '~/models/season.server';
import {
  getSleeperUserByOwnerId,
  getSleeperUsersByOwnerIds,
  matchSleeperOwnerToUser,
} from '~/models/sleeperUser.server';
import { getUser, getUsers } from '~/models/user.server';
import { authenticator, requireAdmin } from '~/services/auth.server';
import { normalizeName } from '~/utils/names';

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
    getLeaguesByYear(currentSeason.year),
    getUsers(),
  ]);

  // The mapping table is the source of truth for what "matched" means. A team
  // can carry a stale userId from an older sync, so checking Team.userId alone
  // would hide owners whose mapping has since been deleted.
  const existingMatches = await getSleeperUsersByOwnerIds(
    leagues.flatMap(league => league.teams.map(team => team.sleeperOwnerId)),
  );
  const matchedOwnerIds = new Set(
    existingMatches.map(({ sleeperOwnerID }) => sleeperOwnerID),
  );

  // A Discord name that belongs to two members can't be suggested, since there
  // is no way to tell which of them the Sleeper account is.
  const memberIdsByName = new Map<string, string[]>();
  for (const member of members) {
    const key = normalizeName(member.discordName);
    // A name that is all emoji or all punctuation normalizes away to nothing,
    // and nothing is not a name that matches anybody.
    if (!key) {
      continue;
    }
    memberIdsByName.set(key, [...(memberIdsByName.get(key) ?? []), member.id]);
  }
  const suggestMemberId = (...names: (string | null)[]) => {
    for (const name of names) {
      const key = name ? normalizeName(name) : '';
      const matches = key ? memberIdsByName.get(key) : undefined;
      if (matches?.length === 1) {
        return matches[0];
      }
    }
    return '';
  };

  const leaguesWithUnmatched = await Promise.all(
    leagues.map(async league => {
      const unmatchedTeams = league.teams.filter(
        team => !matchedOwnerIds.has(team.sleeperOwnerId),
      );

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
    members: members.map(({ id, discordName }) => ({ id, discordName })),
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
    <>
      <h2 className='mt-0'>Unmatched Sleeper Users ({year})</h2>
      <p>
        Every team in this year's leagues whose Sleeper account isn't tied to a
        Discord member yet. Matching here also backfills every team that Sleeper
        account owns, so there's no need to resync the league afterwards. If the
        person has never logged into the site, they won't be in the list of
        members and you'll need to{' '}
        <Link to='/admin/members/add'>add them manually</Link> first.
      </p>
      {actionData?.message && (
        <Alert message={actionData.message} status={actionData.status} />
      )}
      {totalUnmatched === 0 && (
        <p>Every team in {year} is matched to a Discord member. Nice.</p>
      )}
      {leagues.map(league => (
        <section key={league.id}>
          <h3>
            {league.name} (Tier {league.tier})
          </h3>
          {league.lookupError && (
            <Alert
              message={`Could not load Sleeper usernames for this league: ${league.lookupError}`}
              status='error'
            />
          )}
          {league.unmatchedTeams.length === 0 ? (
            <p>
              All {league.teamCount} teams are matched.
              {league.teamCount < 12 &&
                ' (This league has fewer than 12 teams synced.)'}
            </p>
          ) : (
            <table className='w-full'>
              <thead>
                <tr>
                  <th>Sleeper User</th>
                  <th>Team Name</th>
                  <th>Sleeper Owner ID</th>
                  <th>Discord Member</th>
                </tr>
              </thead>
              <tbody>
                {league.unmatchedTeams.map(team => (
                  <tr key={team.teamId}>
                    <td>
                      {team.username ? (
                        <a href={`https://sleeper.com/user/${team.username}`}>
                          {team.displayName ?? team.username}
                        </a>
                      ) : (
                        team.displayName ?? 'Unknown'
                      )}
                      {team.displayName &&
                        team.username &&
                        team.displayName !== team.username && (
                          <div className='text-sm opacity-75'>
                            @{team.username}
                          </div>
                        )}
                    </td>
                    <td>{team.teamName ?? '-'}</td>
                    <td>{team.sleeperOwnerId}</td>
                    <td className='not-prose'>
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
              </tbody>
            </table>
          )}
        </section>
      ))}
    </>
  );
}
