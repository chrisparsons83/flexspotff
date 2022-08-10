import type { LoaderArgs } from "@remix-run/node";
import { authenticator, requireAdmin } from "~/auth.server";
import type { League } from "~/models/league.server";
import { getLeagues } from "~/models/league.server";
import { superjson, useSuperLoaderData } from "~/utils/data";

type LoaderData = {
  leagues: League[];
};

export const loader = async ({ request }: LoaderArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });
  requireAdmin(user);

  const leagues = await getLeagues();

  return superjson<LoaderData>(
    { leagues },
    { headers: { "x-superjson": "true" } }
  );
};

export default function LeaguesList() {
  const { leagues } = useSuperLoaderData<typeof loader>();

  return (
    <>
      <h2>League List</h2>
      <table className="w-full">
        <thead>
          <tr>
            <th>Year</th>
            <th>Name</th>
            <th>Tier</th>
            <th>Sleeper Link</th>
            <th>Draft Link</th>
          </tr>
        </thead>
        <tbody>
          {leagues.map((league) => (
            <tr key={league.id}>
              <td>{league.year}</td>
              <td>{league.name}</td>
              <td>{league.tier}</td>
              <td>
                <a
                  href={`https://sleeper.com/leagues/${league.sleeperLeagueId}`}
                >
                  Sleeper
                </a>
              </td>
              <td>
                <a
                  href={`https://sleeper.com/draft/nfl/${league.sleeperDraftId}`}
                >
                  Draft
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
