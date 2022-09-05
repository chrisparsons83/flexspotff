import type { LoaderArgs } from "@remix-run/node";

import { getQBStreamingWeek } from "~/models/qbstreamingweek.server";
import type { User } from "~/models/user.server";

import { authenticator } from "~/services/auth.server";
import { superjson } from "~/utils/data";

type LoaderData = {
  user: User;
  qbStreamingWeek: Awaited<ReturnType<typeof getQBStreamingWeek>>;
};

export const loader = async ({ params, request }: LoaderArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });

  const id = params.id;
  if (!id) throw new Error(`No QB streaming week ID found`);

  const qbStreamingWeek = await getQBStreamingWeek(id);
  if (!qbStreamingWeek) throw new Error(`QB Streaming Week ID does not exist`);

  return superjson<LoaderData>(
    { user, qbStreamingWeek },
    { headers: { "x-superjson": "true" } }
  );
};

export default function QBStreamingYearWeekEntry() {
  return (
    <>
      <h2>Edit Streaming Picks for Week</h2>
    </>
  );
}
