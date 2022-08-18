import type { ActionArgs, LoaderArgs } from "@remix-run/node";
import { Form } from "@remix-run/react";

import type { Registration } from "~/models/registration.server";
import { getRegistrationByUserAndYear } from "~/models/registration.server";
import { createRegistration } from "~/models/registration.server";
import type { User } from "~/models/user.server";

import Button from "~/components/ui/Button";
import { authenticator } from "~/services/auth.server";
import { CURRENT_YEAR } from "~/utils/constants";
import { superjson, useSuperLoaderData } from "~/utils/data";

type ActionData = {
  formError?: string;
  registration?: Registration;
};

type LoaderData = {
  user: User;
  registration: Registration | null;
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

  let registration = await getRegistrationByUserAndYear(user.id, CURRENT_YEAR);

  return superjson<LoaderData>(
    { user, registration },
    { headers: { "x-superjson": "true" } }
  );
};

export default function Dashboard() {
  const { registration } = useSuperLoaderData<typeof loader>();

  return (
    <div>
      <h2>2022 League Registration</h2>
      {registration ? (
        <p>
          Thanks! You registered at {registration.createdAt.toLocaleString()}
        </p>
      ) : (
        <>
          <p>
            You have not yet registered for the 2022 leagues. Currently, we are
            all filled, but clicking the button below will add you to the wait
            lists in case spots open up.
          </p>
          <Form method="post">
            <input type="hidden" name="year" value={CURRENT_YEAR} />
            <Button type="submit">
              Register for wait lists for 2022 Leagues
            </Button>
          </Form>
        </>
      )}
    </div>
  );
}
