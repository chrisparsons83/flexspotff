import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form, useNavigation } from '@remix-run/react';
import { useEffect, useRef } from 'react';
import {
  typedjson,
  useTypedActionData,
  useTypedLoaderData,
} from 'remix-typedjson';
import Alert from '~/components/ui/Alert';
import Button from '~/components/ui/Button';
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
      { errors: { displayName: 'Display Name is required' } },
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
      { errors: { seasonId: 'Omni Season is required' } },
      { status: 400 },
    );
  }
  if (
    typeof relativeSortString !== 'string' ||
    !/^-?\d+$/.test(relativeSortString)
  ) {
    return typedjson(
      { errors: { relativeSort: 'Relative Sort must be an integer' } },
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
    console.error('Error creating Omni Player:', error);
    // Consider more specific error handling based on Prisma errors if needed
    return typedjson(
      { errors: { form: 'Failed to create Omni Player. Please try again.' } },
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

  return (
    <div>
      <h2>Add Omni Player</h2>
      {actionData &&
        'successMessage' in actionData &&
        actionData.successMessage && (
          <Alert message={actionData.successMessage} status='success' />
        )}
      {actionData &&
        'errors' in actionData &&
        actionData.errors &&
        'form' in actionData.errors &&
        actionData.errors.form && (
          <Alert message={actionData.errors.form} status='error' />
        )}

      <Form method='post' className='space-y-6'>
        <div>
          <label
            htmlFor='displayName'
            className='block text-sm font-medium text-gray-700 dark:text-gray-300'
          >
            Display Name
          </label>
          <input
            type='text'
            name='displayName'
            id='displayName'
            ref={displayNameInputRef}
            required
            className='mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-slate-800 dark:text-white sm:text-sm'
            aria-describedby='displayName-error'
          />
          {actionData &&
            'errors' in actionData &&
            actionData.errors &&
            'displayName' in actionData.errors &&
            actionData.errors.displayName && (
              <p className='mt-2 text-sm text-red-600' id='displayName-error'>
                {actionData.errors.displayName}
              </p>
            )}
        </div>

        <div>
          <label
            htmlFor='sportId'
            className='block text-sm font-medium text-gray-700 dark:text-gray-300'
          >
            Sport
          </label>
          <select
            id='sportId'
            name='sportId'
            className='mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 dark:border-gray-600 dark:bg-slate-800 dark:text-white sm:text-sm'
            aria-describedby='sportId-error'
          >
            <option value=''>Select Sport</option>
            {omniSports.map(sport => (
              <option key={sport.id} value={sport.id}>
                {sport.name}
              </option>
            ))}
          </select>
          {actionData &&
            'errors' in actionData &&
            actionData.errors &&
            'sportId' in actionData.errors &&
            actionData.errors.sportId && (
              <p className='mt-2 text-sm text-red-600' id='sportId-error'>
                {actionData.errors.sportId}
              </p>
            )}
        </div>

        <div>
          <label
            htmlFor='seasonId'
            className='block text-sm font-medium text-gray-700 dark:text-gray-300'
          >
            Omni Season
          </label>
          <select
            id='seasonId'
            name='seasonId'
            className='mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 dark:border-gray-600 dark:bg-slate-800 dark:text-white sm:text-sm'
            aria-describedby='seasonId-error'
          >
            <option value=''>Select Omni Season</option>
            {omniSeasons.map(season => (
              <option key={season.id} value={season.id}>
                {season.year}
              </option>
            ))}
          </select>
          {actionData &&
            'errors' in actionData &&
            actionData.errors &&
            'seasonId' in actionData.errors &&
            actionData.errors.seasonId && (
              <p className='mt-2 text-sm text-red-600' id='seasonId-error'>
                {actionData.errors.seasonId}
              </p>
            )}
        </div>

        <div>
          <label
            htmlFor='relativeSort'
            className='block text-sm font-medium text-gray-700 dark:text-gray-300'
          >
            Relative Sort
          </label>
          <input
            type='number'
            name='relativeSort'
            id='relativeSort'
            required
            defaultValue={99}
            className='mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-slate-800 dark:text-white sm:text-sm'
            aria-describedby='relativeSort-error'
          />
          {actionData &&
            'errors' in actionData &&
            actionData.errors &&
            'relativeSort' in actionData.errors &&
            actionData.errors.relativeSort && (
              <p className='mt-2 text-sm text-red-600' id='relativeSort-error'>
                {actionData.errors.relativeSort}
              </p>
            )}
        </div>

        <div>
          <Button type='submit' disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create Omni Player'}
          </Button>
        </div>
      </Form>
    </div>
  );
}
