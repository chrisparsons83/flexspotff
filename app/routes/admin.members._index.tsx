import type { LoaderArgs } from "@remix-run/node";
import { Link } from "@remix-run/react";

import type { SleeperUser } from "~/models/sleeperUser.server";
import type { User } from "~/models/user.server";
import { getUsers } from "~/models/user.server";

import { superjson, useSuperLoaderData } from "~/utils/data";

type LoaderData = {
  users: (User & {
    sleeperUsers: SleeperUser[];
  })[];
};

export const loader = async ({ request }: LoaderArgs) => {
  const users = await getUsers();

  return superjson<LoaderData>(
    { users },
    { headers: { "x-superjson": "true" } }
  );
};

export default function PodcastEpisodeList() {
  const { users } = useSuperLoaderData<typeof loader>();

  return (
    <>
      <h2 className="mt-0">Members</h2>
      <table className="w-full">
        <thead>
          <tr>
            <th>Member</th>
            <th>Sleeper IDs</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>{user.discordName}</td>
              <td>
                <ul className="!my-0">
                  {user.sleeperUsers.map((sleeperUser) => (
                    <li key={sleeperUser.sleeperOwnerID} className="!my-1">
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
