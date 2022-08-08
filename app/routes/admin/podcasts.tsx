import type { LoaderArgs } from "@remix-run/node";
import { Outlet } from "@remix-run/react";
import { authenticator, requirePodcastEditor } from "~/auth.server";

export const loader = async ({ request }: LoaderArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });
  requirePodcastEditor(user);

  return {};
};

export default function Podcasts() {
  return <Outlet />;
}
