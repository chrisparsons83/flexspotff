import type { OmniPlayer } from '@prisma/client';
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form } from '@remix-run/react';
import clsx from 'clsx';
import type { ChangeEvent } from 'react';
import { useState } from 'react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import Button from '~/components/ui/Button';
import {
  getPlayersAndAssociatedPick,
  updateOmniPlayer,
} from '~/models/omniplayer.server';
import type { OmniScoreCreate } from '~/models/omniscore.server';
import { createOmniScore } from '~/models/omniscore.server';
import { getOmniSeason } from '~/models/omniseason.server';
import { getActiveSports } from '~/models/omnisport.server';
import { authenticator, requireAdmin } from '~/services/auth.server';

const OMNI_YEAR = 2025;

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

      // get existing points for players
      const players = await getPlayersAndAssociatedPick(omniSeason.id);

      const updates = new Map<string, ScoringUpdate>();
      for (const [key, value] of formData.entries()) {
        const [playerId, action] = key.split('--');

        if (!action) continue;

        updates.set(playerId, { ...updates.get(playerId), [action]: value });
      }

      const updatesToSend: (
        | Promise<Partial<OmniPlayer>>
        | Promise<OmniScoreCreate>
      )[] = [];
      for (const [id, data] of updates) {
        const existingScore =
          players.find(player => player.id === id)?.pointsScored || 0;
        if (Number(data.pointsAdded) > 0 || data.isEliminated === 'on') {
          updatesToSend.push(
            updateOmniPlayer({
              id,
              pointsScored: existingScore + Number(data.pointsAdded),
              isComplete: data.isEliminated === 'on' ? true : false,
            }),
          );
          updatesToSend.push(
            createOmniScore({
              playerId: id,
              pointsAdded: Number(data.pointsAdded),
              isEliminated: data.isEliminated === 'on' ? true : false,
            }),
          );
        }
      }
      await Promise.all(updatesToSend);
      break;
  }

  return typedjson({ message: 'Scores have been updated.' });
};

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  const sports = await getActiveSports();

  const omniSeason = await getOmniSeason(OMNI_YEAR);
  if (!omniSeason) {
    throw new Error('Why is there no season, Chris?');
  }

  const players = omniSeason?.omniTeams.flatMap(omniTeam =>
    omniTeam.draftPicks
      .map(draftPick => draftPick.player)
      .filter(player => player !== null),
  );

  players.sort((a, b) => a.displayName.localeCompare(b.displayName));

  return typedjson({ sports, players });
};

const AdminOmniScoring = () => {
  const [activeSport, setActiveSport] = useState('');
  const { sports, players } = useTypedLoaderData<typeof loader>();

  const handleChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setActiveSport(e.target.value);
  };

  return (
    <div>
      <h2>Adjust Scoring</h2>
      <Form method='POST'>
        <h3>Choose Sport</h3>
        <p>Note: only the sport selected here will have its data updated.</p>
        <div>
          <select
            name='sportId'
            className='form-select mt-1 block w-full dark:border-0 dark:bg-slate-800'
            onChange={handleChange}
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
          <>
            <h3>Active Players</h3>
            <table>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Current Points</th>
                  <th>Points to Add</th>
                  <th>Player Eliminated</th>
                </tr>
              </thead>
              <tbody>
                {players
                  .filter(
                    player =>
                      player &&
                      player.sportId === activeSport &&
                      !player.isComplete,
                  )
                  .map((player, index) => {
                    if (!player) return null;

                    return (
                      <tr
                        key={player.id}
                        className={clsx(
                          index % 2 === 0 ? 'bg-gray-900' : 'bg-gray-800',
                          'p-2',
                        )}
                      >
                        <td>{player.displayName}</td>
                        <td>{player.pointsScored}</td>
                        <td>
                          <select
                            name={`${player.id}--pointsAdded`}
                            className='form-select mt-1 block w-full dark:border-0 dark:bg-slate-600'
                          >
                            <option value='0'>0</option>
                            <option value='10'>10</option>
                            <option value='20'>20</option>
                            <option value='30'>30</option>
                          </select>
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
                  <th>Player</th>
                  <th>Total Points</th>
                </tr>
              </thead>
              <tbody>
                {players
                  .filter(
                    player =>
                      player &&
                      player.sportId === activeSport &&
                      player.isComplete,
                  )
                  .map((player, index) => {
                    if (!player) return null;

                    return (
                      <tr
                        key={player.id}
                        className={clsx(
                          index % 2 === 0 ? 'bg-gray-900' : 'bg-gray-800',
                          'p-2',
                        )}
                      >
                        <td>{player.displayName}</td>
                        <td>{player.pointsScored}</td>
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
