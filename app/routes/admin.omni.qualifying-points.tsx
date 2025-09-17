import type { OmniSportEventPoints } from '@prisma/client';
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form, useNavigation } from '@remix-run/react';
import clsx from 'clsx';
import type { ChangeEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  typedjson,
  useTypedActionData,
  useTypedLoaderData,
} from 'remix-typedjson';
import Alert from '~/components/ui/Alert';
import Button from '~/components/ui/FlexSpotButton';
import { getPlayersAndAssociatedPick } from '~/models/omniplayer.server';
import { getOmniSeason } from '~/models/omniseason.server';
import { getOmniSportEvents } from '~/models/omnisportevent.server';
import {
  createOmniSportEventPoints,
  updateOmniSportEventPoints,
} from '~/models/omnisporteventpoints.server';
import { authenticator, requireAdmin } from '~/services/auth.server';
import { OMNI_YEAR } from '~/utils/constants';

export const action = async ({ request }: ActionFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  const omniSeason = await getOmniSeason(OMNI_YEAR);
  if (!omniSeason) {
    throw new Error('Where is the season, Chris?');
  }

  const formData = await request.formData();
  const action = formData.get('_action');

  type ScoringUpdate = {
    pointsAdded?: number;
    isEliminated?: string;
  };

  switch (action) {
    case 'updatePoints':
      const sportId = formData.get('sportId');
      if (typeof sportId !== 'string') {
        throw new Error('Sport ID is generated incorrectly.');
      }
      const sportEventId = formData.get('sportEventId');
      if (typeof sportEventId !== 'string') {
        throw new Error('Sport event ID is generated incorrectly');
      }

      // get existing points for players
      const sportEvents = await getOmniSportEvents();
      const sportEvent = sportEvents.find(
        sportEvent => sportEvent.id === sportEventId,
      );
      if (!sportEvent) {
        throw new Error('Sport event not found.');
      }

      const updates = new Map<string, ScoringUpdate>();
      for (const [key, value] of formData.entries()) {
        const [playerId, action] = key.split('--');

        if (!action) continue;

        updates.set(playerId, { ...updates.get(playerId), [action]: value });
      }

      const updatesToSend: Promise<OmniSportEventPoints>[] = [];
      for (const [id, data] of updates) {
        const existingScore = sportEvent.omniSportEventPoints.find(
          eventPoints => eventPoints.playerId === id,
        );
        const pointsToStart = existingScore?.points || 0;
        const totalPoints = pointsToStart + Number(data.pointsAdded);
        if (Number(data.pointsAdded) !== 0 || data.isEliminated === 'on') {
          if (existingScore) {
            updatesToSend.push(
              updateOmniSportEventPoints({
                id: existingScore.id,
                points: totalPoints,
                isComplete: data.isEliminated === 'on' ? true : false,
              }),
            );
          } else {
            updatesToSend.push(
              createOmniSportEventPoints({
                playerId: id,
                eventId: sportEventId,
                points: totalPoints,
                isComplete: data.isEliminated === 'on' ? true : false,
              }),
            );
          }
        }
        await Promise.all(updatesToSend);
      }

      break;
  }

  return typedjson({ message: 'Scores have been updated.' });
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  const sportEvents = await getOmniSportEvents();

  const sports = Array.from(
    new Set(sportEvents.map(sportEvent => sportEvent.sport.id)),
  )
    .map(
      sportId =>
        sportEvents.find(sportEvent => sportEvent.sport.id === sportId)?.sport,
    )
    .filter(sport => sport !== undefined);

  const omniSeason = await getOmniSeason(OMNI_YEAR);
  if (!omniSeason) {
    throw new Error('Why is there no season, Chris?');
  }

  const players = await getPlayersAndAssociatedPick(omniSeason.id);

  players.sort((a, b) => a.displayName.localeCompare(b.displayName));

  return typedjson({ sports, sportEvents, players });
};

const AdminOmniScoring = () => {
  const [activeSport, setActiveSport] = useState('');
  const [activeSportEvent, setActiveSportEvent] = useState('');
  const [allChecked, setAllChecked] = useState(false);
  const { sports, sportEvents, players } = useTypedLoaderData<typeof loader>();
  const actionData = useTypedActionData<typeof action>();
  const navigation = useNavigation();

  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (navigation.state === 'idle') {
      formRef.current?.reset();
      setActiveSport('');
      setActiveSportEvent('');
      document.documentElement.scrollTo({
        top: 0,
        left: 0,
        behavior: 'instant', // Optional if you want to skip the scrolling animation
      });
    }
  }, [navigation.state]);

  const handleSportChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setActiveSport(e.target.value);
    setActiveSportEvent('');
    setAllChecked(false);
  };

  const handleSportEventChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setActiveSportEvent(e.target.value);
    setAllChecked(false);
  };

  const toggleAllCheckboxes = () => {
    const newState = !allChecked;
    setAllChecked(newState);

    const checkboxes = document.querySelectorAll<HTMLInputElement>(
      'input[name$="--isEliminated"]',
    );
    checkboxes.forEach(checkbox => {
      checkbox.checked = newState;
    });
  };

  const currentSportEvent = sportEvents.find(
    sportEvent => sportEvent.id === activeSportEvent,
  );

  return (
    <div>
      <h2>Adjust Qualifying Points</h2>
      {actionData?.message && <Alert message={actionData.message} />}
      <Form method='POST' ref={formRef} preventScrollReset={true}>
        <h3>Choose Sport</h3>
        <p>Note: only the sport selected here will have its data updated.</p>
        <div>
          <select
            name='sportId'
            className='form-select mt-1 block w-full dark:border-0 dark:bg-slate-800'
            onChange={handleSportChange}
          >
            <option value=''>Choose sport...</option>
            {sports.map(({ id, name }) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </div>
        {activeSport !== '' && (
          <div>
            <select
              name='sportEventId'
              className='form-select mt-1 block w-full dark:border-0 dark:bg-slate-800'
              onChange={handleSportEventChange}
            >
              <option value=''>Choose event...</option>
              {sportEvents
                .filter(sportEvent => sportEvent.sportId === activeSport)
                .map(({ id, name }) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
            </select>
          </div>
        )}
        {activeSportEvent !== '' && (
          <>
            <h3>Active Players</h3>
            <div className='mb-4'>
              <Button
                type='button'
                onClick={toggleAllCheckboxes}
                className='bg-gray-100 text-gray-900 hover:bg-gray-200'
              >
                {allChecked ? 'Clear Checkboxes' : 'Select All Players'}
              </Button>
            </div>
            <table>
              <thead>
                <tr className='text-left'>
                  <th className='not-prose px-4'>Player</th>
                  <th>Current Points</th>
                  <th>Points to Add</th>
                  <th className='px-4'>Player Eliminated</th>
                </tr>
              </thead>
              <tbody className='align-middle'>
                {players
                  .filter(
                    player =>
                      player &&
                      player.sportId === activeSport &&
                      currentSportEvent?.omniSportEventPoints.find(
                        entry => entry.playerId === player.id,
                      )?.isComplete !== true,
                  )
                  .map((player, index) => {
                    if (!player) return null;

                    const currentPoints =
                      currentSportEvent?.omniSportEventPoints
                        .filter(
                          eventPoints => eventPoints.playerId === player.id,
                        )
                        .reduce(
                          (acc, eventPoints) => acc + eventPoints.points,
                          0,
                        ) || 0;

                    return (
                      <tr
                        key={player.id}
                        className={clsx(
                          index % 2 === 0 ? 'bg-gray-900' : 'bg-gray-800',
                          'p-2',
                        )}
                      >
                        <td className='not-prose px-4'>
                          <div>{player.displayName}</div>
                        </td>
                        <td>{currentPoints}</td>
                        <td>
                          <input
                            name={`${player.id}--pointsAdded`}
                            className='form-input block w-full dark:border-0 dark:bg-slate-600'
                          />
                        </td>
                        <td>
                          <input
                            type='checkbox'
                            name={`${player.id}--isEliminated`}
                            defaultChecked={player.isComplete}
                          />
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
            <div className='pt-4'>
              <Button type='submit' name='_action' value='updatePoints'>
                Update Scores
              </Button>
            </div>
            <h3>Completed Players</h3>
            <table>
              <thead>
                <tr>
                  <th className='not-prose px-4 text-left'>Player</th>
                  <th>Total Points</th>
                </tr>
              </thead>
              <tbody>
                {players
                  .filter(
                    player =>
                      player &&
                      player.sportId === activeSport &&
                      currentSportEvent?.omniSportEventPoints.find(
                        entry => entry.playerId === player.id,
                      )?.isComplete === true,
                  )
                  .map((player, index) => {
                    if (!player) return null;
                    const currentPoints =
                      currentSportEvent?.omniSportEventPoints
                        .filter(
                          eventPoints => eventPoints.playerId === player.id,
                        )
                        .reduce(
                          (acc, eventPoints) => acc + eventPoints.points,
                          0,
                        ) || 0;

                    return (
                      <tr
                        key={player.id}
                        className={clsx(
                          index % 2 === 0 ? 'bg-gray-900' : 'bg-gray-800',
                          'p-2',
                        )}
                      >
                        <td className='not-prose px-4'>{player.displayName}</td>
                        <td>{currentPoints}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </>
        )}
      </Form>
    </div>
  );
};

export default AdminOmniScoring;
