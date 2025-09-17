import { Link } from '@remix-run/react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import { getUsers } from '~/models/user.server';

export const loader = async () => {
  const users = await getUsers();

  return typedjson({ users });
};

export default function PodcastEpisodeList() {
  const { users } = useTypedLoaderData<typeof loader>();

  return (
    <>
      <h2 className='mt-0'>Members</h2>
      <table className='w-full'>
        <thead>
          <tr>
            <th>Member</th>
            <th>Sleeper IDs</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(user => (
            <tr key={user.id}>
              <td>{user.discordName}</td>
              <td>
                <ul className='!my-0'>
                  {user.sleeperUsers.map(sleeperUser => (
                    <li key={sleeperUser.sleeperOwnerID} className='!my-1'>
                      {sleeperUser.sleeperOwnerID}
                    </li>
                  ))}
                </ul>
              </td>
              <td>
                <Link to={`./${user.id}`}>Edit</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
