import type { ActionArgs, LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData, useTransition } from "@remix-run/react";
import { authenticator } from "~/auth.server";
import Button from "~/components/Button";

type ActionData = {
  formError?: string;
  fieldErrors?: {
    userId: string | undefined;
  };
  fields?: {
    userId: string;
  };
  successMessage?: string;
};

export const action = async ({
  request,
}: ActionArgs): Promise<Response | ActionData> => {
  return json<ActionData>({ successMessage: "Your entry has been updated." });
};

export const loader = async ({ request }: LoaderArgs) => {
  await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });

  return {};
};

export default function FSquaredMyEntry() {
  const actionData = useActionData<ActionData>();
  const transition = useTransition();

  const buttonText =
    transition.state === "submitting"
      ? "Submitting..."
      : transition.state === "loading"
      ? "Submitted!"
      : "Submit";

  return (
    <div>
      <h2>My F² Entry</h2>
      <Form method="post">
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
    </div>
  );
}
