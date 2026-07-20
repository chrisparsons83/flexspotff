import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form, useNavigation } from '@remix-run/react';
import clsx from 'clsx';
import { useState } from 'react';
import {
  typedjson,
  useTypedLoaderData,
  useTypedActionData,
} from 'remix-typedjson';
import Alert from '~/components/ui/Alert';
import Button from '~/components/ui/FlexSpotButton';
import { getDraftSlotsBySeason } from '~/models/draftSlot.server';
import {
  getDraftSlotsWithUserPreferences,
  upsertUserDraftSlotPreferences,
} from '~/models/draftSlotPreference.server';
import type { Registration } from '~/models/registration.server';
import {
  getRegistrationByUserAndYear,
  getRegistrationCountByYear,
  registerWithDraftPreferences,
} from '~/models/registration.server';
import { getCurrentSeason } from '~/models/season.server';
import { authenticator } from '~/services/auth.server';

const MINIMUM_DRAFT_TIMES = 3;

type ActionData = {
  formError?: string;
  registration?: Registration;
  success?: boolean;
};

/**
 * Parse the JSON list of selected draft-slot ids submitted by the form and
 * narrow it to ids that actually belong to the given season.
 */
function parseSelectedSlotIds(
  raw: FormDataEntryValue | null,
  validSlotIds: Set<string>,
): string[] | null {
  if (typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const valid = parsed.filter(
      (id): id is string => typeof id === 'string' && validSlotIds.has(id),
    );
    // Dedupe so a forged/replayed submission can't violate the
    // (userId, draftSlotId) unique constraint.
    return [...new Set(valid)];
  } catch {
    return null;
  }
}

export const action = async ({
  request,
}: ActionFunctionArgs): Promise<Response | ActionData> => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });

  const currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    return { formError: 'No active season currently' };
  }

  const form = await request.formData();
  const actionType = form.get('actionType');

  // Draft slots that exist for the current season, used to validate the
  // submitted selection and to know whether registration is even possible.
  const seasonSlots = await getDraftSlotsBySeason({
    seasonId: currentSeason.id,
  });
  const validSlotIds = new Set(seasonSlots.map(slot => slot.id));

  if (actionType === 'register') {
    if (!currentSeason.isOpenForRegistration) {
      return { formError: 'Registration is not currently open.' };
    }

    const existing = await getRegistrationByUserAndYear(
      user.id,
      currentSeason.year,
    );
    if (existing) {
      return { formError: 'You are already registered for this season.' };
    }

    if (validSlotIds.size === 0) {
      return {
        formError:
          'Registration is not open yet — draft times have not been posted.',
      };
    }

    const draftSlotIds = parseSelectedSlotIds(
      form.get('preferences'),
      validSlotIds,
    );
    if (!draftSlotIds || draftSlotIds.length < MINIMUM_DRAFT_TIMES) {
      return {
        formError: `Please select at least ${MINIMUM_DRAFT_TIMES} draft times you can make.`,
      };
    }

    try {
      await registerWithDraftPreferences(
        user.id,
        currentSeason.year,
        currentSeason.id,
        draftSlotIds,
      );
      return typedjson({ success: true });
    } catch {
      return { formError: 'Failed to register. Please try again.' };
    }
  }

  if (actionType === 'updateDraftPreferences') {
    const draftSlotIds = parseSelectedSlotIds(
      form.get('preferences'),
      validSlotIds,
    );
    if (!draftSlotIds || draftSlotIds.length < MINIMUM_DRAFT_TIMES) {
      return {
        formError: `Please select at least ${MINIMUM_DRAFT_TIMES} draft times you can make.`,
      };
    }

    try {
      await upsertUserDraftSlotPreferences(
        user.id,
        currentSeason.id,
        draftSlotIds,
      );
      return typedjson({ success: true });
    } catch {
      return { formError: 'Failed to update draft preferences' };
    }
  }

  return { formError: 'Invalid action' };
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });

  const currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    throw new Error('No active season currently');
  }

  const registration = await getRegistrationByUserAndYear(
    user.id,
    currentSeason.year,
  );

  const registrationsCount = await getRegistrationCountByYear(
    currentSeason.year,
  );

  // Draft slots for the current season, annotated with whether this user has
  // already selected each one. Loaded whether or not the user is registered so
  // the combined registration form can show them.
  const draftSlots = await getDraftSlotsWithUserPreferences(
    user.id,
    currentSeason.id,
  );

  return typedjson({
    user,
    registration,
    currentSeason,
    registrationsCount,
    draftSlots,
    hasDraftSlots: draftSlots.length > 0,
  });
};

export default function Dashboard() {
  const {
    registration,
    currentSeason,
    registrationsCount,
    draftSlots,
    hasDraftSlots,
  } = useTypedLoaderData<typeof loader>();
  const actionData = useTypedActionData<typeof action>() as ActionData | null;
  const navigation = useNavigation();

  const [selectedSlots, setSelectedSlots] = useState(() => {
    const selected = new Set<string>();
    draftSlots.forEach(slot => {
      if (slot.isSelected) {
        selected.add(slot.id);
      }
    });
    return selected;
  });

  const hasMinimumSelections = selectedSlots.size >= MINIMUM_DRAFT_TIMES;
  const isSubmitting = navigation.state !== 'idle';

  const isRegistrationFull =
    currentSeason.registrationSize <= registrationsCount;

  const registerButtonText = isRegistrationFull
    ? `Join wait list for ${currentSeason.year} Leagues`
    : `Register for ${currentSeason.year} Leagues`;

  const toggleSlot = (slotId: string, checked: boolean) => {
    setSelectedSlots(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(slotId);
      } else {
        next.delete(slotId);
      }
      return next;
    });
  };

  const renderSlotGrid = () => (
    <div className='not-prose my-4 grid gap-2'>
      {draftSlots.map((slot, index) => (
        <label
          key={slot.id}
          className={clsx(
            index % 2 === 0 ? 'bg-gray-900' : 'bg-gray-800',
            'flex cursor-pointer items-center gap-3 rounded p-2',
          )}
        >
          <input
            type='checkbox'
            value={slot.id}
            checked={selectedSlots.has(slot.id)}
            onChange={e => toggleSlot(slot.id, e.target.checked)}
            className='h-4 w-4 cursor-pointer'
          />
          <span>
            {slot.draftDateTime.toLocaleString(undefined, {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              timeZoneName: 'short',
            })}
          </span>
        </label>
      ))}
    </div>
  );

  const renderSelectionStatus = () =>
    hasMinimumSelections ? (
      <p className='text-sm text-green-400'>
        ✓ {selectedSlots.size} draft time
        {selectedSlots.size === 1 ? '' : 's'} selected
      </p>
    ) : (
      <p className='text-sm text-red-400'>
        ⚠️ Please select at least {MINIMUM_DRAFT_TIMES} draft times you can
        make. Currently selected: {selectedSlots.size}
      </p>
    );

  return (
    <div>
      <h2>{currentSeason.year} League Registration</h2>

      {actionData?.success && (
        <Alert message='Draft preferences saved successfully!' />
      )}
      {actionData?.formError && (
        <Alert message={actionData.formError} status='error' />
      )}

      {registration ? (
        <>
          <p>
            Thanks! You signed up at {registration.createdAt.toLocaleString()}
          </p>
          {hasDraftSlots && (
            <div>
              <h3>Draft Time Preferences</h3>
              <p>
                Select all draft times that you can make. You must keep at least{' '}
                {MINIMUM_DRAFT_TIMES} selected:
              </p>

              <Form method='post'>
                <input
                  type='hidden'
                  name='actionType'
                  value='updateDraftPreferences'
                />
                <input
                  type='hidden'
                  name='preferences'
                  value={JSON.stringify(Array.from(selectedSlots))}
                />

                {renderSlotGrid()}
                <div className='my-4'>{renderSelectionStatus()}</div>

                <Button
                  type='submit'
                  disabled={!hasMinimumSelections || isSubmitting}
                >
                  Save Draft Preferences
                </Button>
              </Form>
            </div>
          )}
        </>
      ) : (
        <>
          {!currentSeason.isOpenForRegistration ? (
            <p>Registration is not currently open.</p>
          ) : !hasDraftSlots ? (
            <p>
              Registration for the {currentSeason.year} leagues will open once
              the draft times have been posted. Check back soon!
            </p>
          ) : (
            <>
              <p>
                You have not yet registered for the {currentSeason.year}{' '}
                leagues. To register, select all the draft times you can make —
                at least {MINIMUM_DRAFT_TIMES}.
              </p>
              {isRegistrationFull && (
                <p>
                  The current season is fully subscribed. You can register below
                  for the wait list but a spot is not guaranteed.
                </p>
              )}

              <Form method='post'>
                <input type='hidden' name='actionType' value='register' />
                <input
                  type='hidden'
                  name='preferences'
                  value={JSON.stringify(Array.from(selectedSlots))}
                />

                {renderSlotGrid()}
                <div className='my-4'>{renderSelectionStatus()}</div>

                <Button
                  type='submit'
                  disabled={!hasMinimumSelections || isSubmitting}
                >
                  {registerButtonText}
                </Button>
              </Form>
            </>
          )}
        </>
      )}
    </div>
  );
}
