import type { LoaderArgs } from "@remix-run/node";
import { Link } from "@remix-run/react";
import { authenticator } from "~/auth.server";
import {
  getEntryByUserAndYear,
  getResultsForYear,
} from "~/models/fsquared.server";
import { CURRENT_YEAR } from "~/utils/constants";
import { superjson, useSuperLoaderData } from "~/utils/data";

// Doing this because Prisma hates me actually aggregating a sum based on connected fields.
type ArrElement<ArrType> = ArrType extends readonly (infer ElementType)[]
  ? ElementType
  : never;
type currentResultsBase =
  | ArrElement<Awaited<ReturnType<typeof getResultsForYear>>> & {
      totalPoints: number;
    };

type LoaderData = {
  currentResults: currentResultsBase[];
  existingEntry: Awaited<ReturnType<typeof getEntryByUserAndYear>> | null;
};

export const loader = async ({ request }: LoaderArgs) => {
  const user = await authenticator.isAuthenticated(request);

  const existingEntry = user
    ? await getEntryByUserAndYear(user.id, CURRENT_YEAR)
    : null;

  const currentResults = (await getResultsForYear(CURRENT_YEAR))
    .map((entry) => {
      const totalPoints = entry.teams.reduce(
        (prev, curr) => prev + curr.pointsFor,
        0
      );
      return { ...entry, totalPoints };
    })
    .sort((a, b) => {
      const pointsDiff = b.totalPoints - a.totalPoints;
      if (pointsDiff !== 0) return pointsDiff;

      return a.user.discordName.localeCompare(b.user.discordName);
    });

  return superjson<LoaderData>(
    { currentResults, existingEntry },
    { headers: { "x-superjson": "true" } }
  );
};

export default function FSquaredIndex() {
  const { currentResults, existingEntry } = useSuperLoaderData<typeof loader>();
  console.log(currentResults);

  return (
    <>
      <h2>F²</h2>
      <p>
        Pick two teams from each league before they draft. Get points based on
        how many fantasy points they earn during the season. Most combined
        points wins.
      </p>
      <p>
        You are able to change your picks for a league until that league's draft
        starts. Teams are listed by their draft order.
      </p>
      <div>
        <h3>My entry</h3>
        <p>Status: {existingEntry ? `Submitted` : `Not Submitted`}</p>
        <p>
          <Link to="my-entry">View/Edit My Entry</Link>
        </p>
      </div>
      <section>
        <h3>Standings</h3>
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Name</th>
              <th>Points</th>
            </tr>
          </thead>
          <tbody>
            {currentResults.map((result, index) => (
              <tr key={result.id}>
                <td>{index + 1}</td>
                <td>{result.user.discordName}</td>
                <td>{result.totalPoints}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
