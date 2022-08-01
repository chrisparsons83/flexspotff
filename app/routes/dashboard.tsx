import type { ActionArgs, LoaderArgs } from "@remix-run/node";
import { Form } from "@remix-run/react";
import { authenticator } from "~/auth.server";
import type { Registration } from "~/models/registration.server";
import { getRegistrationByUserAndYear } from "~/models/registration.server";
import { createRegistration } from "~/models/registration.server";
import type { User } from "~/models/user.server";
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
          Thanks for registering! You registered at{" "}
          {registration.createdAt.toLocaleString()}
        </p>
      ) : (
        <>
          <p>
            You have not yet registered for the 2022 leagues. Click the button
            below to confirm your interest!
          </p>
          <Form method="post">
            <input type="hidden" name="year" value={CURRENT_YEAR} />
            <button
              type="submit"
              className="focus-visible:ring-offset-2zd inline-flex justify-center rounded-md border border-transparent bg-blue-100 px-4 py-2 text-sm font-medium text-blue-900 hover:bg-blue-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Register for 2022 Leagues
            </button>
          </Form>
        </>
      )}
    </div>
  );
}
