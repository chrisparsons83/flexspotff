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
  return (
    <div>
      <h2>2022 League Registration</h2>
      <p>
        You have not yet registered for the 2022 leagues. Click the button below
        to confirm your interest!
      </p>
      <p>
        <button
          type="button"
          className="focus-visible:ring-offset-2zd inline-flex justify-center rounded-md border border-transparent bg-blue-100 px-4 py-2 text-sm font-medium text-blue-900 hover:bg-blue-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          Register for 2022 Leagues
        </button>
      </p>
    </div>
  );
}
