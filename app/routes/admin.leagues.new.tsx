import type { ActionArgs, LoaderArgs } from '@remix-run/node';
import { fetch } from '@remix-run/node';
import { Form, useActionData, useTransition } from '@remix-run/react';
import z from 'zod';

import { createLeague } from '~/models/league.server';

import Button from '~/components/ui/Button';
import { authenticator, requireAdmin } from '~/services/auth.server';
import { redirect } from '~/utils/data';

type ActionData = {
  formError?: string;
  fieldErrors?: {
    url: string | undefined;
  };
  fields?: {
    url: string;
  };
};

const sleeperJson = z.object({
  draft_id: z.string(),
  season: z.string(),
  name: z.string(),
});
type SleeperJson = z.infer<typeof sleeperJson>;

export const action = async ({ request }: ActionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  const formData = await request.formData();
  const url = formData.get('url');

  if (typeof url !== 'string') {
    throw new Error(`Form not submitted correctly`);
  }

  const urlObject = new URL(url);
  const sleeperLeagueId = urlObject.pathname.split('/')[2];
  const sleeperLeagueRes = await fetch(
    `https://api.sleeper.app/v1/league/${sleeperLeagueId}`,
  );
  const sleeperLeague: SleeperJson = sleeperJson.parse(
    await sleeperLeagueRes.json(),
  );
  const year = Number.parseInt(sleeperLeague.season);

  const league = {
    isActive: year === new Date().getFullYear(),
    name: sleeperLeague.name.replace(/ League/i, ''),
    sleeperLeagueId,
    sleeperDraftId: sleeperLeague.draft_id,
    draftDateTime: null,
    tier: sleeperLeague.name.match(/champion/i) ? 1 : 2,
    year,
    isDrafted: false,
  };

  await createLeague(league);

  return redirect(`/admin/leagues`);
};

export const loader = async ({ request }: LoaderArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  return {};
};

export default function LeagueNew() {
  const actionData = useActionData<ActionData>();
  const transition = useTransition();

  const buttonText =
    transition.state === 'submitting'
      ? 'Submitting...'
      : transition.state === 'loading'
        ? 'Submitted!'
        : 'Submit';

  return (
    <>
      <h2>Add New League</h2>
      <Form method='POST' className='grid grid-cols-1 gap-6'>
        <div>
          <label htmlFor='url'>
            League URL:
            <input
              type='text'
              required
              defaultValue={actionData?.fields?.url}
              name='url'
              id='url'
              aria-invalid={Boolean(actionData?.fieldErrors?.url) || undefined}
              aria-errormessage={
                actionData?.fieldErrors?.url ? 'url-error' : undefined
              }
              className='mt-1 block w-full dark:border-0 dark:bg-slate-800'
            />
          </label>
          {actionData?.fieldErrors?.url ? (
            <p className='form-validation-error' role='alert' id='url-error'>
              {actionData.fieldErrors.url}
            </p>
          ) : null}
        </div>
        <div>
          {actionData?.formError ? (
            <p className='form-validation-error' role='alert'>
              {actionData.formError}
            </p>
          ) : null}
          <Button type='submit' disabled={transition.state !== 'idle'}>
            {buttonText}
          </Button>
        </div>
      </Form>
    </>
  );
}
