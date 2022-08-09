import { superjson, useSuperLoaderData } from "~/utils/data";
import type { LoaderArgs } from "@remix-run/node";
import { Link } from "@remix-run/react";
import type { User } from "~/models/user.server";
import { getUsers } from "~/models/user.server";

type LoaderData = {
  users: User[];
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
            <th>Sleeper ID</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>{user.discordName}</td>
              <td>{user.sleeperOwnerID}</td>
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
