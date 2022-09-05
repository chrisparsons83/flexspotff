import type { LoaderArgs } from "@remix-run/node";
import { Link } from "@remix-run/react";

import { getQBStreamingWeeks } from "~/models/qbstreamingweek.server";
import type { User } from "~/models/user.server";

import { authenticator } from "~/services/auth.server";
import { CURRENT_YEAR } from "~/utils/constants";
import { superjson, useSuperLoaderData } from "~/utils/data";

type LoaderData = {
  user: User;
  qbStreamingWeeks: Awaited<ReturnType<typeof getQBStreamingWeeks>>;
};

export const loader = async ({ params, request }: LoaderArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });

  const qbStreamingWeeks = await getQBStreamingWeeks(CURRENT_YEAR);

  return superjson<LoaderData>(
    { user, qbStreamingWeeks },
    { headers: { "x-superjson": "true" } }
  );
};

export default function QBStreamingIndex() {
  const { qbStreamingWeeks } = useSuperLoaderData<typeof loader>();

  console.log(qbStreamingWeeks);

  return (
    <>
      <h2>QB Streaming Challenge</h2>
      <h3>Rules</h3>
      <p>
        Each week, pick two low-rostered QBs to stream from the available lists
        given. Earn points based on the following point system:
      </p>
      <ul>
        <li>0.04 per passing yard</li>
        <li>0.1 per rushing/receiving yard</li>
        <li>4 points per passing TD</li>
        <li>6 points per rushing/receiving TD</li>
        <li>-2 per interception/fumble</li>
      </ul>
      <p>Highest score at the end of the season wins.</p>
      <h3>My Entries</h3>
      <ul>
        {qbStreamingWeeks.map((qbStreamingWeek) => (
          <li key={qbStreamingWeek.id}>
            <Link to={`./${qbStreamingWeek.id}`}>
              Week {qbStreamingWeek.week}
            </Link>
          </li>
        ))}
      </ul>
      <h3>Standings</h3>
    </>
  );
}
