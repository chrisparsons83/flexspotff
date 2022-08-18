import type { LoaderArgs } from "@remix-run/node";
import { Outlet } from "@remix-run/react";
import { authenticator, requireAdmin } from "~/auth.server";

export const loader = async ({ request }: LoaderArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });
  requireAdmin(user);

  return {};
};

export default function LeaguesIndex() {
  return (
    <>
      <Outlet />
    </>
  );
}
