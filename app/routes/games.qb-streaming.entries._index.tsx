import type { LoaderArgs } from "@remix-run/node";
import { Link } from "@remix-run/react";

import { getQBStreamingWeeks } from "~/models/qbstreamingweek.server";

import { authenticator } from "~/services/auth.server";
import { CURRENT_YEAR } from "~/utils/constants";
import { superjson, useSuperLoaderData } from "~/utils/data";

type LoaderData = {
  qbStreamingWeeks: Awaited<ReturnType<typeof getQBStreamingWeeks>>;
};

export const loader = async ({ params, request }: LoaderArgs) => {
  await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });

  const qbStreamingWeeks = await getQBStreamingWeeks(CURRENT_YEAR);

  return superjson<LoaderData>(
    {
      qbStreamingWeeks,
    },
    { headers: { "x-superjson": "true" } }
  );
};

export default function GamesQBStreamingMyEntries() {
  const { qbStreamingWeeks } = useSuperLoaderData<typeof loader>();

  return (
    <>
      <h2>My Entries</h2>
      <ul>
        {qbStreamingWeeks.map((qbStreamingWeek) => {
          const suffix = qbStreamingWeek.isScored
            ? "- Week Scored"
            : !qbStreamingWeek.isOpen
            ? "- Not Open"
            : "";

          return (
            <li key={qbStreamingWeek.id}>
              <Link to={`./${qbStreamingWeek.id}`}>
                Week {qbStreamingWeek.week} {suffix}
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
