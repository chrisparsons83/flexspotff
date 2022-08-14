import type { ActionArgs, LoaderArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Form, useActionData, useTransition } from "@remix-run/react";
import { authenticator, requireAdmin } from "~/auth.server";
import Button from "~/components/ui/Button";
import type { User } from "~/models/user.server";
import { updateUser } from "~/models/user.server";
import { getUser } from "~/models/user.server";
import { superjson, useSuperLoaderData } from "~/utils/data";

type ActionData = {
  formError?: string;
  fieldErrors?: {
    sleeperOwnerID: string | undefined;
  };
  fields?: {
    sleeperOwnerID: string;
  };
};

type LoaderData = {
  user: User;
};

export const action = async ({
  params,
  request,
}: ActionArgs): Promise<Response | ActionData> => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });
  requireAdmin(user);

  const formData = await request.formData();
  const sleeperOwnerID = formData.get("sleeperOwnerID");

  if (typeof sleeperOwnerID !== "string") {
    throw new Error(`Form not submitted correctly`);
  }

  const fields = { sleeperOwnerID };

  const fieldErrors = {
    sleeperOwnerID:
      sleeperOwnerID.length === 0
        ? "Sleeper Owner ID has no content"
        : undefined,
  };
  if (Object.values(fieldErrors).some(Boolean)) {
    return { fieldErrors, fields };
  }

  await updateUser({
    id: params.id,
    sleeperOwnerID,
  });

  return redirect(`/admin/members`);
};

export const loader = async ({ params }: LoaderArgs) => {
  if (!params.id) {
    throw new Error("Error building page.");
  }

  const user = await getUser(params.id);

  if (!user) {
    throw new Error("Member not found");
  }

  return superjson<LoaderData>(
    { user },
    { headers: { "x-superjson": "true" } }
  );
};

export default function EditUser() {
  const { user } = useSuperLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const transition = useTransition();

  const buttonText =
    transition.state === "submitting"
      ? "Submitting..."
      : transition.state === "loading"
      ? "Submitted!"
      : "Submit";

  return (
    <>
      <h2>Edit User {user.discordName}</h2>
      <Form method="post" className="grid grid-cols-1 gap-6">
        <div>
          <label htmlFor="sleeperOwnerID">
            Sleeper Owner ID:
            <input
              type="text"
              required
              defaultValue={
                user?.sleeperOwnerID ?? actionData?.fields?.sleeperOwnerID
              }
              name="sleeperOwnerID"
              id="sleeperOwnerID"
              aria-invalid={
                Boolean(actionData?.fieldErrors?.sleeperOwnerID) || undefined
              }
              aria-errormessage={
                actionData?.fieldErrors?.sleeperOwnerID
                  ? "sleeperOwnerID-error"
                  : undefined
              }
              className="mt-1 block w-full dark:border-0 dark:bg-slate-800"
            />
          </label>
          {actionData?.fieldErrors?.sleeperOwnerID ? (
            <p
              className="form-validation-error"
              role="alert"
              id="sleeperOwnerID-error"
            >
              {actionData.fieldErrors.sleeperOwnerID}
            </p>
          ) : null}
        </div>
        <div>
          {actionData?.formError ? (
            <p className="form-validation-error" role="alert">
              {actionData.formError}
            </p>
          ) : null}
          <Button type="submit" disabled={transition.state !== "idle"}>
            {buttonText}
          </Button>
        </div>
      </Form>
    </>
  );
}
