import type { ActionArgs, LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData, useTransition } from "@remix-run/react";

import { getQBStreamingWeek } from "~/models/qbstreamingweek.server";
import type { User } from "~/models/user.server";

import Alert from "~/components/ui/Alert";
import Button from "~/components/ui/Button";
import { authenticator } from "~/services/auth.server";
import { superjson, useSuperLoaderData } from "~/utils/data";

type ActionData = {
  message?: string;
};

type LoaderData = {
  user: User;
  qbStreamingWeek: Awaited<ReturnType<typeof getQBStreamingWeek>>;
};

export const action = async ({ params, request }: ActionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });

  return json<ActionData>({ message: "Your picks have been saved." });
};

export const loader = async ({ params, request }: LoaderArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });

  const id = params.id;
  if (!id) throw new Error(`No QB streaming week ID found`);

  const qbStreamingWeek = await getQBStreamingWeek(id);
  if (!qbStreamingWeek) throw new Error(`QB Streaming Week ID does not exist`);

  return superjson<LoaderData>(
    { user, qbStreamingWeek },
    { headers: { "x-superjson": "true" } }
  );
};

export default function QBStreamingYearWeekEntry() {
  const actionData = useActionData<ActionData>();
  const { qbStreamingWeek } = useSuperLoaderData<typeof loader>();
  const transition = useTransition();

  return (
    <>
      <h2>Edit Streaming Picks for Week {qbStreamingWeek?.week}</h2>
      {actionData?.message && <Alert message={actionData.message} />}
      <Form method="post">
        <div className="mb-4">
          <label htmlFor="standardPlayerId">
            Standard Selection:
            <select
              defaultValue={""}
              name="standardPlayerId"
              id="standardPlayerId"
              required
              className="form-select mt-1 block w-full dark:border-0 dark:bg-slate-800"
            >
              <option value=""></option>
              {qbStreamingWeek?.QBStreamingWeekOptions.map((qbOption) => (
                <option key={qbOption.id} value={qbOption.id}>
                  {qbOption.player.fullName}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mb-4">
          <label htmlFor="deepPlayerId">
            Deep Selection:
            <select
              defaultValue={""}
              name="deepPlayerId"
              id="deepPlayerId"
              required
              className="form-select mt-1 block w-full dark:border-0 dark:bg-slate-800"
            >
              <option value=""></option>
              {qbStreamingWeek?.QBStreamingWeekOptions.filter(
                (qbOption) => qbOption.isDeep
              ).map((qbOption) => (
                <option key={qbOption.id} value={qbOption.id}>
                  {qbOption.player.fullName}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div>
          <Button
            type="submit"
            name="_action"
            value="saveOptions"
            disabled={transition.state !== "idle"}
          >
            Update Entry
          </Button>
        </div>
      </Form>
    </>
  );
}
