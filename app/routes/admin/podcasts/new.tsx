import {
  unstable_composeUploadHandlers,
  unstable_createMemoryUploadHandler,
  unstable_parseMultipartFormData,
} from "@remix-run/node";
import type { ActionArgs, UploadHandler } from "@remix-run/node";
import { Form, useActionData, useTransition } from "@remix-run/react";
import Button from "~/components/Button";
import { redirect } from "~/utils/data";
import { s3UploadHandler } from "~/services/s3client.server";

type ActionData = {
  formError?: string;
  fieldErrors?: {
    title: string | undefined;
    season: string | undefined;
    episode: string | undefined;
    description: string | undefined;
    showNotes: string | undefined;
    publishDate: string | undefined;
    podcastFile: string | undefined;
    durationMinutes: string | undefined;
    durationSeconds: string | undefined;
  };
  fields?: {
    title: string;
    season: string;
    episode: string;
    description: string;
    showNotes: string;
    publishDate: string;
    podcastFile: string;
    durationMinutes: string;
    durationSeconds: string;
  };
};

// TODO: Bring this into a settings page
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

  console.log(formData.get("podcastFile"));

  return redirect(`/admin/podcasts/new`);
};

export default function PodcastEpisodeCreate() {
  const actionData = useActionData<ActionData>();
  const transition = useTransition();

  const buttonText =
    transition.state === "submitting"
      ? "Adding..."
      : transition.state === "loading"
      ? "Added!"
      : "Add";

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
                required
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
            <label htmlFor="season">
              Season:
              <select
                defaultValue={actionData?.fields?.season}
                name="season"
                required
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
                    <option value={season} key={season}>
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
                required
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
            <label htmlFor="description">
              Description:
              <textarea
                name="description"
                required
                id="description"
                defaultValue={actionData?.fields?.description}
                aria-invalid={
                  Boolean(actionData?.fieldErrors?.description) || undefined
                }
                aria-errormessage={
                  actionData?.fieldErrors?.description
                    ? "description-error"
                    : undefined
                }
                className="mt-1 block w-full dark:border-0 dark:bg-slate-800"
                rows={3}
              ></textarea>
            </label>
            {actionData?.fieldErrors?.description ? (
              <p
                className="form-validation-error"
                role="alert"
                id="description-error"
              >
                {actionData.fieldErrors.description}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="showNotes">
              Show Notes:
              <textarea
                name="showNotes"
                required
                id="showNotes"
                defaultValue={actionData?.fields?.showNotes}
                aria-invalid={
                  Boolean(actionData?.fieldErrors?.showNotes) || undefined
                }
                aria-errormessage={
                  actionData?.fieldErrors?.showNotes
                    ? "showNotes-error"
                    : undefined
                }
                className="mt-1 block w-full dark:border-0 dark:bg-slate-800"
                rows={3}
              ></textarea>
            </label>
            {actionData?.fieldErrors?.showNotes ? (
              <p
                className="form-validation-error"
                role="alert"
                id="showNotes-error"
              >
                {actionData.fieldErrors.showNotes}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="publishDate">
              Publish Date:
              <input
                type="date"
                defaultValue={actionData?.fields?.publishDate}
                name="publishDate"
                required
                id="publishDate"
                aria-invalid={
                  Boolean(actionData?.fieldErrors?.publishDate) || undefined
                }
                aria-errormessage={
                  actionData?.fieldErrors?.publishDate
                    ? "publishDate-error"
                    : undefined
                }
                className="mt-1 block w-full dark:border-0 dark:bg-slate-800"
              />
            </label>
            {actionData?.fieldErrors?.publishDate ? (
              <p
                className="form-validation-error"
                role="alert"
                id="publishDate-error"
              >
                {actionData.fieldErrors.publishDate}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="podcastFile">
              Podcast File:
              <input
                type="file"
                required
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
            <label htmlFor="durationMinutes">
              Duration:{" "}
              <span className="text-sm italic text-slate-400">
                (mm:ss format)
              </span>
              <div className="flex">
                <div className="shrink basis-1/2">
                  <input
                    type="number"
                    min={0}
                    defaultValue={actionData?.fields?.durationMinutes}
                    name="durationMinutes"
                    required
                    id="durationMinutes"
                    aria-invalid={
                      Boolean(actionData?.fieldErrors?.durationMinutes) ||
                      undefined
                    }
                    aria-errormessage={
                      actionData?.fieldErrors?.durationMinutes
                        ? "durationMinutes-error"
                        : undefined
                    }
                    className="mt-1 block w-full dark:border-0 dark:bg-slate-800"
                  />
                </div>
                <div className="grow px-2">:</div>
                <div className="shrink basis-1/2">
                  <input
                    type="number"
                    min={0}
                    max={59}
                    defaultValue={actionData?.fields?.durationSeconds}
                    name="durationSeconds"
                    required
                    id="durationSeconds"
                    aria-invalid={
                      Boolean(actionData?.fieldErrors?.durationSeconds) ||
                      undefined
                    }
                    aria-errormessage={
                      actionData?.fieldErrors?.durationSeconds
                        ? "durationSeconds-error"
                        : undefined
                    }
                    className="mt-1 block w-full dark:border-0 dark:bg-slate-800"
                  />
                </div>
              </div>
            </label>
            {actionData?.fieldErrors?.durationMinutes ? (
              <p
                className="form-validation-error"
                role="alert"
                id="durationMinutes-error"
              >
                {actionData.fieldErrors.durationMinutes}
              </p>
            ) : null}
            {actionData?.fieldErrors?.durationSeconds ? (
              <p
                className="form-validation-error"
                role="alert"
                id="durationSeconds-error"
              >
                {actionData.fieldErrors.durationSeconds}
              </p>
            ) : null}
          </div>
          <div>
            {actionData?.formError ? (
              <p className="form-validation-error" role="alert">
                {actionData.formError}
              </p>
            ) : null}
            <Button type="submit">{buttonText}</Button>
          </div>
        </Form>
      </div>
    </>
  );
}
