import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form, useActionData, useNavigation } from '@remix-run/react';
import { redirect } from 'remix-typedjson';
import { Button } from '~/components/ui/button';
import { Field } from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { Section } from '~/components/ui/section';
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
      ? 'Submitting…'
      : navigation.state === 'loading'
      ? 'Submitted'
      : 'Submit';

  return (
    <Section title='Add new league'>
      <Form method='POST' className='grid max-w-md gap-6'>
        <Field label='League URL' error={actionData?.fieldErrors?.url}>
          <Input required defaultValue={actionData?.fields?.url} name='url' />
        </Field>
        <div>
          {actionData?.formError ? (
            <p className='text-negative' role='alert'>
              {actionData.formError}
            </p>
          ) : null}
          <Button type='submit' disabled={navigation.state !== 'idle'}>
            {buttonText}
          </Button>
        </div>
      </Form>
    </Section>
  );
}
