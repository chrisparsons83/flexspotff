import {
  unstable_composeUploadHandlers,
  unstable_createMemoryUploadHandler,
  unstable_parseMultipartFormData,
} from "@remix-run/node";
import type { ActionArgs, UploadHandler } from "@remix-run/node";
import { Form, useActionData } from "@remix-run/react";
import Button from "~/components/Button";
import { redirect } from "~/utils/data";
import { s3UploadHandler } from "~/services/s3client.server";

type ActionData = {
  formError?: string;
  fieldErrors?: {
    title: string | undefined;
    season: string | undefined;
    episode: string | undefined;
    podcastFile: string | undefined;
  };
  fields?: {
    title: string;
    season: string;
    episode: string;
    podcastFile: string | undefined;
  };
};

const SEASONS = [2, 1];

export const action = async ({
  request,
}: ActionArgs): Promise<Response | ActionData> => {
  const uploadHandler: UploadHandler = unstable_composeUploadHandlers(
    s3UploadHandler,
    unstable_createMemoryUploadHandler()
  );
  const formData = await unstable_parseMultipartFormData(
    request,
    uploadHandler
  );

  console.log(formData);

  return redirect(`/admin/podcasts/new`);
};

export default function PodcastEpisodeCreate() {
  const actionData = useActionData<ActionData>();

  return (
    <>
      <h2 className="mt-0">Add Podcast Episode</h2>
      <div>
        <Form
          method="post"
          className="grid grid-cols-1 gap-6"
          encType="multipart/form-data"
        >
          <div>
            <label htmlFor="title">
              Title:
              <input
                type="text"
                defaultValue={actionData?.fields?.title}
                name="title"
                id="title"
                aria-invalid={
                  Boolean(actionData?.fieldErrors?.title) || undefined
                }
                aria-errormessage={
                  actionData?.fieldErrors?.title ? "title-error" : undefined
                }
                className="mt-1 block w-full dark:border-0 dark:bg-slate-800"
              />
            </label>
            {actionData?.fieldErrors?.title ? (
              <p
                className="form-validation-error"
                role="alert"
                id="title-error"
              >
                {actionData.fieldErrors.title}
              </p>
            ) : null}
          </div>
          <div>
            <label>
              Season:
              <select
                defaultValue={actionData?.fields?.season}
                name="season"
                aria-invalid={
                  Boolean(actionData?.fieldErrors?.season) || undefined
                }
                aria-errormessage={
                  actionData?.fieldErrors?.season ? "season-error" : undefined
                }
                className="form-select mt-1 block w-full dark:border-0 dark:bg-slate-800"
              >
                {SEASONS.map((season) => {
                  return (
                    <option
                      value={season}
                      key={season}
                      selected={
                        !!actionData?.fields?.season &&
                        season === Number.parseInt(actionData?.fields?.season)
                      }
                    >
                      {season}
                    </option>
                  );
                })}
              </select>
            </label>
            {actionData?.fieldErrors?.season ? (
              <p
                className="form-validation-error"
                role="alert"
                id="season-error"
              >
                {actionData.fieldErrors.season}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="episode">
              Episode:
              <input
                type="number"
                min="1"
                defaultValue={actionData?.fields?.episode}
                name="episode"
                id="episode"
                aria-invalid={
                  Boolean(actionData?.fieldErrors?.episode) || undefined
                }
                aria-errormessage={
                  actionData?.fieldErrors?.episode ? "episode-error" : undefined
                }
                className="mt-1 block w-full dark:border-0 dark:bg-slate-800"
              />
            </label>
            {actionData?.fieldErrors?.episode ? (
              <p
                className="form-validation-error"
                role="alert"
                id="episode-error"
              >
                {actionData.fieldErrors.episode}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="episode">
              Podcast File:
              <input
                type="file"
                defaultValue={actionData?.fields?.podcastFile}
                name="podcastFile"
                id="podcastFile"
                aria-invalid={
                  Boolean(actionData?.fieldErrors?.podcastFile) || undefined
                }
                aria-errormessage={
                  actionData?.fieldErrors?.podcastFile
                    ? "podcastFile-error"
                    : undefined
                }
                className="mt-1 block w-full dark:border-0 dark:bg-slate-800"
              />
            </label>
            {actionData?.fieldErrors?.podcastFile ? (
              <p
                className="form-validation-error"
                role="alert"
                id="podcastFile-error"
              >
                {actionData.fieldErrors.podcastFile}
              </p>
            ) : null}
          </div>
          <div>
            {actionData?.formError ? (
              <p className="form-validation-error" role="alert">
                {actionData.formError}
              </p>
            ) : null}
            <Button type="submit">Add</Button>
          </div>
        </Form>
      </div>
    </>
  );
}
