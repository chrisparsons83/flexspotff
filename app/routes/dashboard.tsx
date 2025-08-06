import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form } from '@remix-run/react';
import { useState } from 'react';
import { typedjson, useTypedLoaderData, useTypedActionData } from 'remix-typedjson';
import Alert from '~/components/ui/Alert';
import Button from '~/components/ui/Button';
import type { Registration } from '~/models/registration.server';
import {
  createRegistration,
  getRegistrationByUserAndYear,
  getRegistrationsByYear,
} from '~/models/registration.server';
import { getCurrentSeason } from '~/models/season.server';
import { getDraftSlotsWithUserPreferences, upsertUserDraftSlotPreferences } from '~/models/draftSlotPreference.server';
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
      await upsertUserDraftSlotPreferences(
        user.id,
        Number.parseInt(season, 10),
        parsedPreferences
      );
      return typedjson({ success: true });
    } catch (error) {
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
      currentSeason.year
    );
  }

  return typedjson({ 
    user, 
    registration, 
    currentSeason, 
    registrationsCount,
    draftSlotsWithPreferences 
  });
};

export default function Dashboard() {
  const { registration, currentSeason, registrationsCount, draftSlotsWithPreferences } =
    useTypedLoaderData<typeof loader>();
  const actionData = useTypedActionData<typeof action>();
  
  const [preferences, setPreferences] = useState(() => {
    if (!draftSlotsWithPreferences) return {};
    const prefs: Record<string, number> = {};
    draftSlotsWithPreferences.forEach((slot: any) => {
      if (slot.userRanking) {
        prefs[slot.id] = slot.userRanking;
      }
    });
    return prefs;
  });

  // Check for duplicate rankings
  const getDuplicateRanks = () => {
    const usedRanks: Record<number, string[]> = {};
    Object.entries(preferences).forEach(([slotId, ranking]) => {
      if (ranking > 0) {
        if (!usedRanks[ranking]) {
          usedRanks[ranking] = [];
        }
        usedRanks[ranking].push(slotId);
      }
    });
    
    const duplicates = new Set<string>();
    Object.values(usedRanks).forEach(slotIds => {
      if (slotIds.length > 1) {
        slotIds.forEach(slotId => duplicates.add(slotId));
      }
    });
    
    return duplicates;
  };

  const duplicateSlots = getDuplicateRanks();
  const hasDuplicates = duplicateSlots.size > 0;

  // Check if all draft slots have rankings
  const getUnrankedSlots = () => {
    if (!draftSlotsWithPreferences) return [];
    return draftSlotsWithPreferences.filter((slot: any) => !preferences[slot.id] || preferences[slot.id] <= 0);
  };

  const unrankedSlots = getUnrankedSlots();
  const hasUnrankedSlots = unrankedSlots.length > 0;
  const canSave = !hasDuplicates && !hasUnrankedSlots;

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
          {draftSlotsWithPreferences && draftSlotsWithPreferences.length > 0 && (
            <div style={{ marginTop: '2rem' }}>
              <h3>Draft Time Preferences</h3>
              <p>Rank your preferred draft times from 1 (most preferred) to {draftSlotsWithPreferences.length} (least preferred):</p>
              
              {(actionData as ActionData)?.success && (
                <div style={{ marginBottom: '1rem' }}>
                  <Alert message="Draft preferences saved successfully!" />
                </div>
              )}
              {(actionData as ActionData)?.formError && (
                <div style={{ marginBottom: '1rem' }}>
                  <Alert message={(actionData as ActionData).formError || 'An error occurred'} />
                </div>
              )}
              
              <Form method="post">
                <input type="hidden" name="actionType" value="updateDraftPreferences" />
                <input type="hidden" name="season" value={currentSeason.year} />
                <input 
                  type="hidden" 
                  name="preferences" 
                  value={JSON.stringify(
                    Object.entries(preferences)
                      .filter(([_, ranking]) => ranking > 0)
                      .map(([draftSlotId, ranking]) => ({ draftSlotId, ranking }))
                  )}
                />
                
                <div style={{ display: 'grid', gap: '1rem', marginBottom: '1rem' }}>
                  {draftSlotsWithPreferences.map((slot: any) => (
                    <div key={slot.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ flex: 1 }}>
                        {slot.draftDateTime.toLocaleString(undefined, {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                          timeZoneName: 'short'
                        })}
                      </div>
                      <div>
                        <select
                          id={`ranking-${slot.id}`}
                          value={preferences[slot.id] || ''}
                          onChange={(e) => {
                            const newRanking = parseInt(e.target.value, 10);
                            setPreferences(prev => ({
                              ...prev,
                              [slot.id]: newRanking
                            }));
                          }}
                          style={{ 
                            padding: '0.5rem', 
                            minWidth: '80px', 
                            width: '100px', 
                            color: 'black',
                            backgroundColor: duplicateSlots.has(slot.id) ? '#ffebee' : 'white',
                            borderColor: duplicateSlots.has(slot.id) ? '#f44336' : '#ccc',
                            borderWidth: '2px'
                          }}
                        >
                          <option value="">-</option>
                          {Array.from({ length: draftSlotsWithPreferences.length }, (_, i) => (
                            <option key={i + 1} value={i + 1}>{i + 1}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
                
                {hasDuplicates && (
                  <p style={{ color: '#f44336', fontSize: '0.875rem', marginBottom: '1rem' }}>
                    ⚠️ Please fix duplicate rankings before saving. Each rank can only be used once.
                  </p>
                )}
                
                {hasUnrankedSlots && (
                  <p style={{ color: '#f44336', fontSize: '0.875rem', marginBottom: '1rem' }}>
                    ⚠️ Please rank all draft slots before saving. {unrankedSlots.length} slot{unrankedSlots.length === 1 ? '' : 's'} still need{unrankedSlots.length === 1 ? 's' : ''} ranking.
                  </p>
                )}
                
                <Button type="submit" disabled={!canSave}>
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
            <Form method="post">
              <input type="hidden" name="actionType" value="register" />
              <input type="hidden" name="year" value={currentSeason.year} />
              <Button type="submit">{buttonText}</Button>
            </Form>
          ) : (
            <p>Registration is not currently open.</p>
          )}
        </>
      )}
    </div>
  );
}
