import type { LoaderArgs } from "@remix-run/node";

import { getRegistrationsByYear } from "~/models/registration.server";

import { authenticator, requireAdmin } from "~/services/auth.server";
import { CURRENT_YEAR } from "~/utils/constants";
import { superjson, useSuperLoaderData } from "~/utils/data";

type LoaderData = {
  registrations: Awaited<ReturnType<typeof getRegistrationsByYear>>;
};

export const loader = async ({ request }: LoaderArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });
  requireAdmin(user);

  let registrations = await getRegistrationsByYear(CURRENT_YEAR);

  return superjson<LoaderData>(
    { registrations },
    { headers: { "x-superjson": "true" } }
  );
};

export default function RegistrationList() {
  const { registrations } = useSuperLoaderData<typeof loader>();

  return (
    <>
      <h2 className="mt-0">Registration List</h2>
      <ol>
        {registrations.map((registration) => (
          <li key={registration.id}>{registration.user.discordName}</li>
        ))}
      </ol>
    </>
  );
}
