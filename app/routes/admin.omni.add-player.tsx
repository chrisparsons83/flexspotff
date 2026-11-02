import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form, useNavigation } from '@remix-run/react';
import { useEffect, useRef } from 'react';
import {
  typedjson,
  useTypedActionData,
  useTypedLoaderData,
} from 'remix-typedjson';
import Alert from '~/components/ui/Alert';
import { Button } from '~/components/ui/button';
import { Field } from '~/components/ui/field';
import { Input, NativeSelect } from '~/components/ui/input';
import { Section } from '~/components/ui/section';
import { createOmniPlayer } from '~/models/omniplayer.server';
import { getAllOmniSeasons } from '~/models/omniseason.server';
import { getActiveSports } from '~/models/omnisport.server';
import { authenticator, requireAdmin } from '~/services/auth.server';

// Define ActionData types and type guards
type SuccessActionData = { successMessage: string };
type ErrorActionData = {
  errors: {
    displayName?: string;
    sportId?: string;
    seasonId?: string;
    relativeSort?: string;
    form?: string;
  };
};
type ActionDataType = SuccessActionData | ErrorActionData;

function isSuccessData(data: any): data is SuccessActionData {
  return data && typeof data.successMessage === 'string';
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  // Fetch seasons and sports in parallel
  const [omniSeasons, omniSports] = await Promise.all([
    getAllOmniSeasons(),
    getActiveSports(),
  ]);

  return typedjson({ omniSeasons, omniSports });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  const formData = await request.formData();
  const displayName = formData.get('displayName');
  const sportId = formData.get('sportId');
  const seasonId = formData.get('seasonId');
  const relativeSortString = formData.get('relativeSort');

  if (typeof displayName !== 'string' || displayName.trim() === '') {
    return typedjson(
      { errors: { displayName: 'Display name is required' } },
      { status: 400 },
    );
  }
  if (typeof sportId !== 'string' || sportId.trim() === '') {
    return typedjson(
      { errors: { sportId: 'Sport is required' } },
      { status: 400 },
    );
  }
  if (typeof seasonId !== 'string' || seasonId.trim() === '') {
    return typedjson(
      { errors: { seasonId: 'Omni season is required' } },
      { status: 400 },
    );
  }
  if (
    typeof relativeSortString !== 'string' ||
    !/^-?\d+$/.test(relativeSortString)
  ) {
    return typedjson(
      { errors: { relativeSort: 'Relative sort must be an integer' } },
      { status: 400 },
    );
  }

  const relativeSort = parseInt(relativeSortString, 10);

  try {
    const newPlayer = await createOmniPlayer({
      displayName,
      sportId,
      seasonId,
      relativeSort,
    });
    return typedjson({
      successMessage: `Omni player ${newPlayer.displayName} created successfully`,
    });
  } catch (error) {
    console.error('Error creating Omni player:', error);
    // Consider more specific error handling based on Prisma errors if needed
    return typedjson(
      { errors: { form: 'Failed to create Omni player. Please try again.' } },
      { status: 500 },
    );
  }
};

export default function AddOmniPlayerPage() {
  const { omniSeasons, omniSports } = useTypedLoaderData<typeof loader>();
  const actionData = useTypedActionData<ActionDataType>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  const displayNameInputRef = useRef<HTMLInputElement>(null);

  // Clear display name on successful submission
  useEffect(() => {
    if (isSuccessData(actionData) && displayNameInputRef.current) {
      // actionData.successMessage is implicitly checked by isSuccessData
      displayNameInputRef.current.value = '';
    }
  }, [actionData]);

  const errors =
    actionData && 'errors' in actionData ? actionData.errors : undefined;
  const fieldError = (name: string) =>
    errors && name in errors
      ? (errors as Record<string, string | undefined>)[name]
      : undefined;

  return (
    <Section title='Add Omni Player'>
      {actionData &&
        'successMessage' in actionData &&
        actionData.successMessage && (
          <Alert
            message={actionData.successMessage}
            status='success'
            className='mb-6'
          />
        )}
      {fieldError('form') && (
        <Alert message={fieldError('form')!} status='error' className='mb-6' />
      )}

      <Form method='post' className='grid max-w-sm gap-6'>
        <Field label='Display Name' error={fieldError('displayName')}>
          <Input name='displayName' ref={displayNameInputRef} required />
        </Field>

        <Field label='Sport' error={fieldError('sportId')}>
          <NativeSelect name='sportId'>
            <option value=''>Select Sport</option>
            {omniSports.map(sport => (
              <option key={sport.id} value={sport.id}>
                {sport.name}
              </option>
            ))}
          </NativeSelect>
        </Field>

        <Field label='Omni Season' error={fieldError('seasonId')}>
          <NativeSelect name='seasonId'>
            <option value=''>Select Omni Season</option>
            {omniSeasons.map(season => (
              <option key={season.id} value={season.id}>
                {season.year}
              </option>
            ))}
          </NativeSelect>
        </Field>

        <Field label='Relative Sort' error={fieldError('relativeSort')}>
          <Input type='number' name='relativeSort' required defaultValue={99} />
        </Field>

        <div>
          <Button type='submit' disabled={isSubmitting}>
            {isSubmitting ? 'Creating…' : 'Create Omni Player'}
          </Button>
        </div>
      </Form>
    </Section>
  );
}
