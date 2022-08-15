import type { LoaderArgs } from "@remix-run/node";
import { Link } from "@remix-run/react";
import { authenticator } from "~/auth.server";
import { getEntryByUserAndYear } from "~/models/fsquared.server";
import { CURRENT_YEAR } from "~/utils/constants";
import { superjson, useSuperLoaderData } from "~/utils/data";

type LoaderData = {
  existingEntry: Awaited<ReturnType<typeof getEntryByUserAndYear>> | null;
};

export const loader = async ({ request }: LoaderArgs) => {
  const user = await authenticator.isAuthenticated(request);

  const existingEntry = user
    ? await getEntryByUserAndYear(user.id, CURRENT_YEAR)
    : null;

  return superjson<LoaderData>(
    { existingEntry },
    { headers: { "x-superjson": "true" } }
  );
};

export default function FSquaredIndex() {
  const { existingEntry } = useSuperLoaderData<typeof loader>();

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
      </section>
    </>
  );
}
