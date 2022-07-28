import type { LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticator } from "~/auth.server";

type LoaderData = {
  user: unknown;
};

export const loader = async ({ request }: LoaderArgs) => {
  let user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });

  return json<LoaderData>({ user });
};

export default function Dashboard() {
  return <div>Dashboard!</div>;
}
