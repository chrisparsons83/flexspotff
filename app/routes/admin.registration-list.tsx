import type { LoaderArgs } from "@remix-run/node";

import { getRegistrationsByYear } from "~/models/registration.server";
import { getCurrentSeason } from "~/models/season.server";

import { authenticator, requireAdmin } from "~/services/auth.server";
import { superjson, useSuperLoaderData } from "~/utils/data";

type LoaderData = {
  registrations: Awaited<ReturnType<typeof getRegistrationsByYear>>;
};

export const loader = async ({ request }: LoaderArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });
  requireAdmin(user);

  let currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    throw new Error("No active season currently");
  }

  let registrations = await getRegistrationsByYear(currentSeason.year);

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
