import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form, useActionData, useNavigation } from '@remix-run/react';
import { redirect } from 'remix-typedjson';
import Button from '~/components/ui/FlexSpotButton';
import { getLeagueInfo } from '~/libs/sleeper/api.server';
import { createLeague } from '~/models/league.server';
import { authenticator, requireAdmin } from '~/services/auth.server';

type ActionData = {
  formError?: string;
  fieldErrors?: {
    url: string | undefined;
  };
  fields?: {
    url: string;
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
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
  const sleeperLeague = await getLeagueInfo(sleeperLeagueId);

  // A main league is stored against its draft, so one that hasn't been drafted
  // yet can't be added here. Say so, rather than failing on a schema error.
  if (!sleeperLeague.draft_id || !sleeperLeague.season) {
    throw new Error(
      `Sleeper league ${sleeperLeagueId} has no draft set up yet, so it can't be added.`,
    );
  }

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

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  return {};
};

export default function LeagueNew() {
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();

  const buttonText =
    navigation.state === 'submitting'
      ? 'Submitting...'
      : navigation.state === 'loading'
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
          <Button type='submit' disabled={navigation.state !== 'idle'}>
            {buttonText}
          </Button>
        </div>
      </Form>
    </>
  );
}
