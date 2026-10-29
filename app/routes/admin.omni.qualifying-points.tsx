import type { OmniSportEventPoints } from '@prisma/client';
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form, useNavigation } from '@remix-run/react';
import type { ChangeEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  typedjson,
  useTypedActionData,
  useTypedLoaderData,
} from 'remix-typedjson';
import Alert from '~/components/ui/Alert';
import { Button } from '~/components/ui/button';
import { Field } from '~/components/ui/field';
import { Checkbox, Input, NativeSelect } from '~/components/ui/input';
import { Section } from '~/components/ui/section';
import { Table } from '~/components/ui/table';
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
    <Section title='Adjust Qualifying Points'>
      {actionData?.message && (
        <Alert message={actionData.message} className='mb-6' />
      )}
      <Form method='POST' ref={formRef} preventScrollReset={true}>
        <div className='grid max-w-sm gap-6'>
          <Field
            label='Sport'
            description='Only the sport chosen here has its points updated.'
          >
            <NativeSelect name='sportId' onChange={handleSportChange}>
              <option value=''>Choose Sport…</option>
              {sports.map(({ id, name }) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {activeSport !== '' && (
            <Field label='Event'>
              <NativeSelect
                name='sportEventId'
                onChange={handleSportEventChange}
              >
                <option value=''>Choose Event…</option>
                {sportEvents
                  .filter(sportEvent => sportEvent.sportId === activeSport)
                  .map(({ id, name }) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
              </NativeSelect>
            </Field>
          )}
        </div>
        {activeSportEvent !== '' && (
          <>
            <Section
              as='h3'
              title='Active Players'
              className='mt-10'
              action={
                <Button
                  type='button'
                  onClick={toggleAllCheckboxes}
                  variant='secondary'
                  size='sm'
                >
                  {allChecked ? 'Clear checkboxes' : 'Select all players'}
                </Button>
              }
            >
              <Table
                headers={[
                  'Player',
                  'Current Points',
                  'Points to Add',
                  'Eliminated',
                ]}
                numericColumns={[1]}
              >
                {players
                  .filter(
                    player =>
                      player &&
                      player.sportId === activeSport &&
                      currentSportEvent?.omniSportEventPoints.find(
                        entry => entry.playerId === player.id,
                      )?.isComplete !== true,
                  )
                  .map(player => {
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
                      <tr key={player.id}>
                        <td>{player.displayName}</td>
                        <td className='text-right'>{currentPoints}</td>
                        <td>
                          <Input
                            name={`${player.id}--pointsAdded`}
                            aria-label={`Points to add for ${player.displayName}`}
                            className='w-24'
                          />
                        </td>
                        <td>
                          <Checkbox
                            name={`${player.id}--isEliminated`}
                            aria-label={`${player.displayName} eliminated`}
                            defaultChecked={player.isComplete}
                          />
                        </td>
                      </tr>
                    );
                  })}
              </Table>
              <Button
                type='submit'
                name='_action'
                value='updatePoints'
                className='mt-6'
              >
                Update Scores
              </Button>
            </Section>
            <Section as='h3' title='Completed Players'>
              <Table headers={['Player', 'Total Points']} numericColumns={[1]}>
                {players
                  .filter(
                    player =>
                      player &&
                      player.sportId === activeSport &&
                      currentSportEvent?.omniSportEventPoints.find(
                        entry => entry.playerId === player.id,
                      )?.isComplete === true,
                  )
                  .map(player => {
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
                      <tr key={player.id}>
                        <td>{player.displayName}</td>
                        <td className='text-right'>{currentPoints}</td>
                      </tr>
                    );
                  })}
              </Table>
            </Section>
          </>
        )}
      </Form>
    </Section>
  );
};

export default AdminOmniScoring;
