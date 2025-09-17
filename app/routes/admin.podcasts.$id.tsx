import {
  unstable_composeUploadHandlers,
  unstable_createMemoryUploadHandler,
  unstable_parseMultipartFormData,
} from '@remix-run/node';
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  UploadHandler,
} from '@remix-run/node';
import { Form, useNavigation } from '@remix-run/react';
import { DateTime } from 'luxon';
import {
  typedjson,
  useTypedActionData,
  useTypedLoaderData,
} from 'remix-typedjson';
import Button from '~/components/ui/Button';
import {
  createEpisode,
  getEpisode,
  updateEpisode,
} from '~/models/episode.server';
import { authenticator } from '~/services/auth.server';
import { podcastJsonSchema, s3UploadHandler } from '~/services/s3client.server';
import type { S3FileUpload } from '~/services/s3client.server';

// TODO: Bring this into a settings page
const SEASONS = [3, 2, 1];

export const action = async ({ request }: ActionFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });

  const uploadHandler: UploadHandler = unstable_composeUploadHandlers(
    s3UploadHandler,
    unstable_createMemoryUploadHandler(),
  );
  const formData = await unstable_parseMultipartFormData(
    request,
    uploadHandler,
  );

  // On all forms
  const title = formData.get('title');
  const season = formData.get('season');
  const episode = formData.get('episode');
  const description = formData.get('description');
  const showNotes = formData.get('showNotes');
  const publishDate = formData.get('publishDate');
  // Only on new file submission
  const podcastFileJson = formData.get('podcastFile');
  // Only on Edit Form
  const id = formData.get('id');
  const duration = formData.get('duration');
  const filepath = formData.get('filepath');
  const filesize = formData.get('filesize');

  if (
    typeof title !== 'string' ||
    typeof season !== 'string' ||
    typeof episode !== 'string' ||
    typeof description !== 'string' ||
    typeof showNotes !== 'string' ||
    typeof publishDate !== 'string' ||
    (typeof podcastFileJson !== 'string' && typeof filepath !== 'string')
  ) {
    throw new Error(`Form not submitted correctly.`);
  }

  const podcastFileObject: S3FileUpload =
    typeof podcastFileJson === 'string'
      ? JSON.parse(podcastFileJson)
      : {
          duration: Number.parseInt(String(duration)),
          location: filepath,
          size: Number.parseInt(String(filesize)),
        };
  podcastJsonSchema.parse(podcastFileObject);

  if (!podcastFileObject.size) {
    throw new Error(`Issue getting file size data when uploading file.`);
  }

  const fields = {
    title,
    season,
    episode,
    description,
    showNotes,
    publishDate,
    podcastFile: undefined,
  };

  const seasonNumber = Number.parseInt(season);
  const episodeNumber = Number.parseInt(episode);
  const publishDateObject = DateTime.fromISO(publishDate, {
    zone: 'America/Los_Angeles',
  }).toJSDate();

  const fieldErrors = {
    title: title.length === 0 ? 'Title has no content' : undefined,
    description:
      description.length === 0 ? 'Description has no content' : undefined,
    showNotes: showNotes.length === 0 ? 'Show Notes has no content' : undefined,
  };

  if (Object.values(fieldErrors).some(Boolean)) {
    return typedjson({ fieldErrors, fields });
  }

  if (!id) {
    await createEpisode({
      title,
      season: seasonNumber,
      episode: episodeNumber,
      description,
      shownotes: showNotes,
      publishDate: publishDateObject,
      duration: podcastFileObject.duration,
      filepath: podcastFileObject.location,
      filesize: podcastFileObject.size,
      filetype: 'audio/mpeg',
      authorId: user.id,
    });
  } else {
    await updateEpisode({
      id: String(id),
      title,
      season: seasonNumber,
      episode: episodeNumber,
      description,
      shownotes: showNotes,
      publishDate: publishDateObject,
      duration: podcastFileObject.duration,
      filepath: podcastFileObject.location,
      filesize: podcastFileObject.size,
      filetype: 'audio/mpeg',
      authorId: user.id,
    });
  }

  return typedjson({
    message: 'Podcast has been uploaded.',
    fieldErrors,
    fields,
  });
};

export const loader = async ({ params }: LoaderFunctionArgs) => {
  if (!params.id) {
    throw new Error('Error building page.');
  }

  if (params.id === 'new') {
    return typedjson({ episode: null });
  }

  const episode = await getEpisode(params.id);

  if (!episode) {
    throw new Error('Episode not found');
  }

  return typedjson({ episode });
};

export default function PodcastEpisodeCreate() {
  const { episode } = useTypedLoaderData<typeof loader>();
  const actionData = useTypedActionData<typeof action>();
  const navigation = useNavigation();

  const buttonText =
    navigation.state === 'submitting'
      ? 'Submitting...'
      : navigation.state === 'loading'
      ? 'Submitted!'
      : 'Submit';

  return (
    <>
      <h2 className='mt-0'>Add Podcast Episode</h2>
      <div>
        <Form
          method='POST'
          className='grid grid-cols-1 gap-6'
          encType='multipart/form-data'
        >
          <input type='hidden' name='id' value={episode?.id} />
          <div>
            <label htmlFor='title'>
              Title:
              <input
                type='text'
                required
                defaultValue={episode?.title ?? actionData?.fields?.title}
                name='title'
                id='title'
                aria-invalid={
                  Boolean(actionData?.fieldErrors?.title) || undefined
                }
                aria-errormessage={
                  actionData?.fieldErrors?.title ? 'title-error' : undefined
                }
                className='mt-1 block w-full dark:border-0 dark:bg-slate-800'
              />
            </label>
            {actionData?.fieldErrors?.title ? (
              <p
                className='form-validation-error'
                role='alert'
                id='title-error'
              >
                {actionData.fieldErrors.title}
              </p>
            ) : null}
          </div>
          <div className='flex gap-4'>
            <div className='w-1/2 shrink'>
              <label htmlFor='season'>
                Season:
                <select
                  defaultValue={episode?.season ?? actionData?.fields?.season}
                  name='season'
                  required
                  className='form-select mt-1 block w-full dark:border-0 dark:bg-slate-800'
                >
                  {SEASONS.map(season => {
                    return (
                      <option value={season} key={season}>
                        {season}
                      </option>
                    );
                  })}
                </select>
              </label>
            </div>
            <div className='w-1/2 shrink'>
              <label htmlFor='episode'>
                Episode:
                <input
                  type='number'
                  required
                  min='0'
                  defaultValue={episode?.episode ?? actionData?.fields?.episode}
                  name='episode'
                  id='episode'
                  className='mt-1 block w-full dark:border-0 dark:bg-slate-800'
                />
              </label>
            </div>
          </div>
          <div>
            <label htmlFor='description'>
              Description:
              <textarea
                name='description'
                required
                id='description'
                defaultValue={
                  episode?.description ?? actionData?.fields?.description
                }
                aria-invalid={
                  Boolean(actionData?.fieldErrors?.description) || undefined
                }
                aria-errormessage={
                  actionData?.fieldErrors?.description
                    ? 'description-error'
                    : undefined
                }
                className='mt-1 block w-full dark:border-0 dark:bg-slate-800'
                rows={3}
              ></textarea>
            </label>
            {actionData?.fieldErrors?.description ? (
              <p
                className='form-validation-error'
                role='alert'
                id='description-error'
              >
                {actionData.fieldErrors.description}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor='showNotes'>
              Long Description:{' '}
              <span className='text-sm italic text-gray-400'>
                (can take HTML)
              </span>
              <textarea
                name='showNotes'
                required
                id='showNotes'
                defaultValue={
                  episode?.shownotes ?? actionData?.fields?.showNotes
                }
                aria-invalid={
                  Boolean(actionData?.fieldErrors?.showNotes) || undefined
                }
                aria-errormessage={
                  actionData?.fieldErrors?.showNotes
                    ? 'showNotes-error'
                    : undefined
                }
                className='mt-1 block w-full dark:border-0 dark:bg-slate-800'
                rows={3}
              ></textarea>
            </label>
            {actionData?.fieldErrors?.showNotes ? (
              <p
                className='form-validation-error'
                role='alert'
                id='showNotes-error'
              >
                {actionData.fieldErrors.showNotes}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor='publishDate'>
              Publish Date:
              <input
                type='date'
                defaultValue={
                  episode?.publishDate
                    ? episode?.publishDate.toISOString().split('T')[0]
                    : actionData?.fields?.publishDate
                }
                name='publishDate'
                required
                id='publishDate'
                className='mt-1 block w-full dark:border-0 dark:bg-slate-800'
              />
            </label>
          </div>
          <div>
            <label htmlFor='podcastFile'>
              Podcast File:{' '}
              {episode && (
                <>
                  <a href={episode.filepath}>Current File</a>
                  <input
                    type='hidden'
                    name='duration'
                    value={episode.duration}
                  />
                  <input
                    type='hidden'
                    name='filepath'
                    value={episode.filepath}
                  />
                  <input
                    type='hidden'
                    name='filesize'
                    value={episode.filesize}
                  />
                </>
              )}
              <input
                type='file'
                required={!episode}
                defaultValue={actionData?.fields?.podcastFile}
                name='podcastFile'
                id='podcastFile'
                className='mt-1 block w-full dark:border-0 dark:bg-slate-800'
              />
            </label>
          </div>
          <div>
            <Button type='submit' disabled={navigation.state !== 'idle'}>
              {buttonText}
            </Button>
          </div>
        </Form>
      </div>
    </>
  );
}
