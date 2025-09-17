import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form } from '@remix-run/react';
import { useState } from 'react';
import {
  typedjson,
  useTypedLoaderData,
  useTypedActionData,
} from 'remix-typedjson';
import Alert from '~/components/ui/Alert';
import Button from '~/components/ui/Button';
import {
  getDraftSlotsWithUserPreferences,
  upsertUserDraftSlotPreferences,
} from '~/models/draftSlotPreference.server';
import type { Registration } from '~/models/registration.server';
import {
  createRegistration,
  getRegistrationByUserAndYear,
  getRegistrationsByYear,
} from '~/models/registration.server';
import { getCurrentSeason } from '~/models/season.server';
import { authenticator } from '~/services/auth.server';

type ActionData = {
  formError?: string;
  registration?: Registration;
  success?: boolean;
};

export const action = async ({
  request,
}: ActionFunctionArgs): Promise<Response | ActionData> => {
  let user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });

  const form = await request.formData();
  const actionType = form.get('actionType');

  if (actionType === 'register') {
    const formYear = form.get('year');

    if (typeof formYear !== 'string') {
      return { formError: `Form not submitted correctly` };
    }

    const year = Number.parseInt(formYear, 10);
    let registration = await createRegistration(user.id, year);
    return typedjson({ registration });
  }

  if (actionType === 'updateDraftPreferences') {
    const season = form.get('season');
    const preferences = form.get('preferences');

    if (typeof season !== 'string' || typeof preferences !== 'string') {
      return { formError: 'Invalid form data' };
    }

    try {
      const parsedPreferences = JSON.parse(preferences);

      // Validate that at least 3 draft times are selected
      if (!Array.isArray(parsedPreferences) || parsedPreferences.length < 3) {
        return {
          formError: 'Please select at least 3 draft times you can make.',
        };
      }

      // Convert availability selections to ranking format for backend compatibility
      // Set all selected slots to ranking 1 since there's no preference order
      const rankedPreferences = parsedPreferences.map(pref => ({
        draftSlotId: pref.draftSlotId,
        ranking: 1,
      }));

      await upsertUserDraftSlotPreferences(
        user.id,
        Number.parseInt(season, 10),
        rankedPreferences,
      );
      return typedjson({ success: true });
    } catch {
      return { formError: 'Failed to update draft preferences' };
    }
  }

  return { formError: 'Invalid action' };
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  let user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });

  let currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    throw new Error('No active season currently');
  }

  let registration = await getRegistrationByUserAndYear(
    user.id,
    currentSeason?.year,
  );

  let registrations = await getRegistrationsByYear(currentSeason.year);
  const registrationsCount = registrations.length;

  // Get draft slots with user preferences if user is registered
  let draftSlotsWithPreferences = null;
  if (registration) {
    draftSlotsWithPreferences = await getDraftSlotsWithUserPreferences(
      user.id,
      currentSeason.year,
    );
  }

  return typedjson({
    user,
    registration,
    currentSeason,
    registrationsCount,
    draftSlotsWithPreferences,
  });
};

export default function Dashboard() {
  const {
    registration,
    currentSeason,
    registrationsCount,
    draftSlotsWithPreferences,
  } = useTypedLoaderData<typeof loader>();
  const actionData = useTypedActionData<typeof action>();

  const [selectedSlots, setSelectedSlots] = useState(() => {
    if (!draftSlotsWithPreferences) return new Set<string>();
    const selected = new Set<string>();
    draftSlotsWithPreferences.forEach((slot: any) => {
      if (slot.userRanking) {
        selected.add(slot.id);
      }
    });
    return selected;
  });

  // Check if at least 3 slots are selected
  const hasMinimumSelections = selectedSlots.size >= 3;
  const canSave = hasMinimumSelections;

  const isRegistrationFull =
    currentSeason.registrationSize <= registrationsCount;

  const buttonText = `${
    isRegistrationFull ? 'Join wait list' : 'Register'
  } for ${currentSeason.year} Leagues`;

  return (
    <div>
      <h2>{currentSeason.year} League Registration</h2>
      {registration ? (
        <>
          <p>
            Thanks! You signed up at {registration.createdAt.toLocaleString()}
          </p>
          {draftSlotsWithPreferences &&
            draftSlotsWithPreferences.length > 0 && (
              <div style={{ marginTop: '2rem' }}>
                <h3>Draft Time Preferences</h3>
                <p>
                  Select all draft times that you can make. You must select at
                  least 3 options:
                </p>

                {(actionData as ActionData)?.success && (
                  <div style={{ marginBottom: '1rem' }}>
                    <Alert message='Draft preferences saved successfully!' />
                  </div>
                )}
                {(actionData as ActionData)?.formError && (
                  <div style={{ marginBottom: '1rem' }}>
                    <Alert
                      message={
                        (actionData as ActionData).formError ||
                        'An error occurred'
                      }
                    />
                  </div>
                )}

                <Form method='post'>
                  <input
                    type='hidden'
                    name='actionType'
                    value='updateDraftPreferences'
                  />
                  <input
                    type='hidden'
                    name='season'
                    value={currentSeason.year}
                  />
                  <input
                    type='hidden'
                    name='preferences'
                    value={JSON.stringify(
                      Array.from(selectedSlots).map(draftSlotId => ({
                        draftSlotId,
                        available: true,
                      })),
                    )}
                  />

                  <div
                    style={{
                      display: 'grid',
                      gap: '1rem',
                      marginBottom: '1rem',
                    }}
                  >
                    {draftSlotsWithPreferences.map((slot: any) => (
                      <div
                        key={slot.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '1rem',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                          }}
                        >
                          <input
                            type='checkbox'
                            id={`slot-${slot.id}`}
                            checked={selectedSlots.has(slot.id)}
                            onChange={e => {
                              setSelectedSlots(prev => {
                                const newSelected = new Set(prev);
                                if (e.target.checked) {
                                  newSelected.add(slot.id);
                                } else {
                                  newSelected.delete(slot.id);
                                }
                                return newSelected;
                              });
                            }}
                            style={{
                              width: '18px',
                              height: '18px',
                              cursor: 'pointer',
                            }}
                          />
                          <label
                            htmlFor={`slot-${slot.id}`}
                            style={{
                              cursor: 'pointer',
                              flex: 1,
                              fontSize: '1rem',
                            }}
                          >
                            {slot.draftDateTime.toLocaleString(undefined, {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                              timeZoneName: 'short',
                            })}
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>

                  {!hasMinimumSelections && (
                    <p
                      style={{
                        color: '#f44336',
                        fontSize: '0.875rem',
                        marginBottom: '1rem',
                      }}
                    >
                      ⚠️ Please select at least 3 draft times you can make.
                      Currently selected: {selectedSlots.size}
                    </p>
                  )}

                  {selectedSlots.size > 0 && (
                    <p
                      style={{
                        color: '#4caf50',
                        fontSize: '0.875rem',
                        marginBottom: '1rem',
                      }}
                    >
                      ✓ {selectedSlots.size} draft time
                      {selectedSlots.size === 1 ? '' : 's'} selected
                    </p>
                  )}

                  <Button type='submit' disabled={!canSave}>
                    Save Draft Preferences
                  </Button>
                </Form>
              </div>
            )}
        </>
      ) : (
        <>
          <p>
            You have not yet registered for the {currentSeason.year} leagues.
          </p>
          {isRegistrationFull && (
            <p>
              The current season is fully subscribed. You can register below for
              the wait list but a spot is not guaranteed.
            </p>
          )}
          {currentSeason.isOpenForRegistration ? (
            <Form method='post'>
              <input type='hidden' name='actionType' value='register' />
              <input type='hidden' name='year' value={currentSeason.year} />
              <Button type='submit'>{buttonText}</Button>
            </Form>
          ) : (
            <p>Registration is not currently open.</p>
          )}
        </>
      )}
    </div>
  );
}
