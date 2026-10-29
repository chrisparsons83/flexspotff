import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import { Link } from '~/components/ui/link';
import { Section } from '~/components/ui/section';
import { Table } from '~/components/ui/table';
import { getUsersIncludingMerged } from '~/models/user.server';
import { authenticator, requireAdmin } from '~/services/auth.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const currentUser = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(currentUser);

  const users = await getUsersIncludingMerged();

  return typedjson({ users });
};

export default function PodcastEpisodeList() {
  const { users } = useTypedLoaderData<typeof loader>();

  return (
    <Section title='Members'>
      <Table
        headers={['Member', 'Sleeper IDs', 'Actions']}
        primaryColumns={[2]}
      >
        {users.map(user => (
          <tr key={user.id}>
            <td>
              {user.discordName}
              {user.discordUsername &&
                user.discordUsername !== user.discordName && (
                  <span className='ml-2 text-sm text-muted-foreground'>
                    @{user.discordUsername}
                  </span>
                )}
              {user.inGuild === false && (
                <span className='ml-2 text-sm text-muted-foreground'>
                  (not in server)
                </span>
              )}
              {user.mergedInto && (
                <span className='ml-2 text-sm text-muted-foreground'>
                  (merged into {user.mergedInto.discordName})
                </span>
              )}
            </td>
            <td>
              <ul className='font-mono text-sm'>
                {user.sleeperUsers.map(sleeperUser => (
                  <li key={sleeperUser.sleeperOwnerID}>
                    {sleeperUser.sleeperOwnerID}
                  </li>
                ))}
              </ul>
            </td>
            <td>
              {/* A merged member has no identity of their own to edit -
                    everything they own now belongs to the canonical member. */}
              {user.mergedInto ? (
                <Link to={`./${user.mergedInto.id}`}>
                  Edit {user.mergedInto.discordName}
                </Link>
              ) : (
                <Link to={`./${user.id}`}>Edit</Link>
              )}
            </td>
          </tr>
        ))}
      </Table>
    </Section>
  );
}
