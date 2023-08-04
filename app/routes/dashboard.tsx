import type { ActionArgs, LoaderArgs } from "@remix-run/node";
import { Form } from "@remix-run/react";

import type { Registration } from "~/models/registration.server";
import {
  createRegistration,
  getRegistrationByUserAndYear,
} from "~/models/registration.server";
import type { Season } from "~/models/season.server";
import { getCurrentSeason } from "~/models/season.server";
import type { User } from "~/models/user.server";

import Button from "~/components/ui/Button";
import { authenticator } from "~/services/auth.server";
import { superjson, useSuperLoaderData } from "~/utils/data";

type ActionData = {
  formError?: string;
  registration?: Registration;
};

type LoaderData = {
  user: User;
  registration: Registration | null;
  currentSeason: Season;
};

export const action = async ({
  request,
}: ActionArgs): Promise<Response | ActionData> => {
  let user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });

  const form = await request.formData();
  const formYear = form.get("year");

  if (typeof formYear !== "string") {
    return { formError: `Form not submitted correctly` };
  }

  const year = Number.parseInt(formYear, 10);

  let registration = await createRegistration(user.id, year);

  return superjson<ActionData>({ registration });
};

export const loader = async ({ request }: LoaderArgs) => {
  let user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });

  let currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    throw new Error("No active season currently");
  }

  let registration = await getRegistrationByUserAndYear(
    user.id,
    currentSeason?.year
  );

  return superjson<LoaderData>(
    { user, registration, currentSeason },
    { headers: { "x-superjson": "true" } }
  );
};

export default function Dashboard() {
  const { registration, currentSeason } = useSuperLoaderData<typeof loader>();

  const buttonText = `Register for ${currentSeason.year} Leagues`;

  return (
    <div>
      <h2>{currentSeason.year} League Registration</h2>
      {registration ? (
        <p>
          Thanks! You registered at {registration.createdAt.toLocaleString()}
        </p>
      ) : (
        <>
          <p>
            You have not yet registered for the {currentSeason.year} leagues.
          </p>
          {currentSeason.isOpenForRegistration ? (
            <Form method="POST">
              <input type="hidden" name="year" value={currentSeason.year} />
              <Button type="submit">{buttonText}</Button>
            </Form>
          ) : (
            <p>Registration is not currently open.</p>
          )}
        </>
      )}
    </div>
  );
}
