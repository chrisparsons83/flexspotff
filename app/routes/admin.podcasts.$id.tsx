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
import { Button } from '~/components/ui/button';
import { Field } from '~/components/ui/field';
import { Input, NativeSelect, Textarea } from '~/components/ui/input';
import { ExternalLink } from '~/components/ui/link';
import { Section } from '~/components/ui/section';
import {
  createEpisode,
  getEpisode,
  updateEpisode,
} from '~/models/episode.server';
import { authenticator, requirePodcastEditor } from '~/services/auth.server';
import { podcastJsonSchema, s3UploadHandler } from '~/services/s3client.server';
import type { S3FileUpload } from '~/services/s3client.server';

// TODO: Bring this into a settings page
const SEASONS = [3, 2, 1];

export const action = async ({ request }: ActionFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  // Being logged in is not the same as being allowed - without this any member
  // could create episodes and upload to S3 through the handler below.
  requirePodcastEditor(user);

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
    showNotes: showNotes.length === 0 ? 'Show notes has no content' : undefined,
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

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const currentUser = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requirePodcastEditor(currentUser);

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
      ? 'Submitting…'
      : navigation.state === 'loading'
      ? 'Submitted'
      : 'Submit';

  return (
    <Section title={episode ? 'Edit podcast episode' : 'Add podcast episode'}>
      <Form
        method='POST'
        className='grid max-w-2xl gap-6'
        encType='multipart/form-data'
      >
        <input type='hidden' name='id' value={episode?.id} />
        <Field label='Title' error={actionData?.fieldErrors?.title}>
          <Input
            required
            defaultValue={episode?.title ?? actionData?.fields?.title}
            name='title'
          />
        </Field>
        <div className='grid grid-cols-2 gap-6'>
          <Field label='Season'>
            <NativeSelect
              defaultValue={episode?.season ?? actionData?.fields?.season}
              name='season'
              required
            >
              {SEASONS.map(season => (
                <option value={season} key={season}>
                  {season}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label='Episode'>
            <Input
              type='number'
              required
              min='0'
              defaultValue={episode?.episode ?? actionData?.fields?.episode}
              name='episode'
            />
          </Field>
        </div>
        <Field label='Description' error={actionData?.fieldErrors?.description}>
          <Textarea
            name='description'
            required
            defaultValue={
              episode?.description ?? actionData?.fields?.description
            }
            rows={3}
          />
        </Field>
        <Field
          label='Long description'
          description='Can take HTML.'
          error={actionData?.fieldErrors?.showNotes}
        >
          <Textarea
            name='showNotes'
            required
            defaultValue={episode?.shownotes ?? actionData?.fields?.showNotes}
            rows={3}
          />
        </Field>
        <Field label='Publish date' className='max-w-xs'>
          <Input
            type='date'
            defaultValue={
              episode?.publishDate
                ? episode?.publishDate.toISOString().split('T')[0]
                : actionData?.fields?.publishDate
            }
            name='publishDate'
            required
          />
        </Field>
        {episode && (
          <>
            <input type='hidden' name='duration' value={episode.duration} />
            <input type='hidden' name='filepath' value={episode.filepath} />
            <input type='hidden' name='filesize' value={episode.filesize} />
          </>
        )}
        <div className='grid gap-2'>
          <Field label='Podcast file'>
            <Input type='file' required={!episode} name='podcastFile' />
          </Field>
          {episode && (
            <ExternalLink href={episode.filepath} className='text-sm'>
              Current file
            </ExternalLink>
          )}
        </div>
        <div>
          <Button type='submit' disabled={navigation.state !== 'idle'}>
            {buttonText}
          </Button>
        </div>
      </Form>
    </Section>
  );
}
