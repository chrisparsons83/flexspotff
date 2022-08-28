import type { LoaderArgs } from "@remix-run/node";

import { authenticator, requireAdmin } from "~/services/auth.server";

export const loader = async ({ request }: LoaderArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });
  requireAdmin(user);

  return {};
};

export default function AdminBettingPoolYearWeek() {
  return (
    <div>
      <h2>Edit Picks for Week</h2>
    </div>
  );
}
