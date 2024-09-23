import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form, useNavigation } from '@remix-run/react';
import {
  typedjson,
  useTypedActionData,
  useTypedLoaderData,
} from 'remix-typedjson';
import Alert from '~/components/ui/Alert';
import Button from '~/components/ui/Button';
import { getWeekNflGames } from '~/models/nflgame.server';
import { getActivePlayersByPosition, getPlayer } from '~/models/players.server';
import {
  getQBStreamingWeek,
  updateQBStreamingWeek,
} from '~/models/qbstreamingweek.server';
import {
  createQBStreamingWeekOption,
  deleteQBStreamingWeekOption,
} from '~/models/qbstreamingweekoption.server';
import { authenticator, requireAdmin } from '~/services/auth.server';

export const action = async ({ params, request }: ActionFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  const qbStreamingWeekId = params.id;
  if (!qbStreamingWeekId) throw new Error(`Missing QB Streaming Week ID`);
  const qbStreamingWeek = await getQBStreamingWeek(qbStreamingWeekId);
  if (!qbStreamingWeek) throw new Error(`QB Streaming Week does not exist`);

  const formData = await request.formData();
  const action = formData.get('_action');

  switch (action) {
    case 'addPlayer': {
      const playerId = formData.get('playerId');
      if (typeof playerId !== 'string')
        throw new Error('Player ID has been generated with an error.');

      const isDeep = formData.get('isDeep');

      // Get NFL team ID for the QB
      const player = await getPlayer(playerId);
      if (!player) throw new Error(`Player not found with id ${playerId}`);

      // Get the NFL game where the team ID exists for the current week
      const nflGames = await getWeekNflGames(
        qbStreamingWeek.year,
        qbStreamingWeek.week,
      );
      const nflGame = nflGames.find(
        nflGame =>
          nflGame.awayTeamId === player.currentNFLTeamId ||
          nflGame.homeTeamId === player.currentNFLTeamId,
      );
      if (!nflGame) throw new Error(`Game not found for QB`);

      await createQBStreamingWeekOption({
        playerId,
        isDeep: !!isDeep,
        pointsScored: 0,
        qbStreamingWeekId,
        nflGameId: nflGame.id,
      });

      return typedjson({ message: 'Player has been added.' });
    }
    case 'removePlayer': {
      const qbStreamingWeekOptionId = formData.get('qbStreamingWeekOptionId');
      if (typeof qbStreamingWeekOptionId !== 'string')
        throw new Error('Option does not exist');

      await deleteQBStreamingWeekOption(qbStreamingWeekOptionId);

      return typedjson({ message: 'Player has been removed.' });
    }
    case 'updateWeek': {
      const isOpen = formData.get('isOpen');

      await updateQBStreamingWeek({
        id: qbStreamingWeek.id,
        year: qbStreamingWeek.year,
        week: qbStreamingWeek.week,
        isScored: qbStreamingWeek.isScored,
        isOpen: isOpen ? true : false,
      });

      return typedjson({ message: 'Week has been updated.' });
    }
  }

  return typedjson({ message: 'Nothing has happened.' });
};

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  const qbStreamingWeekId = params.id;
  if (!qbStreamingWeekId) throw new Error(`Missing QB Streaming Week ID`);

  const qbStreamingWeek = await getQBStreamingWeek(qbStreamingWeekId);
  if (!qbStreamingWeek) throw new Error(`QB Streaming week does not exist`);

  const activeQBs = await getActivePlayersByPosition('QB');

  return typedjson({ activeQBs, qbStreamingWeek });
};

export default function AdminSpreadPoolYearWeek() {
  const actionData = useTypedActionData<typeof action>();
  const { activeQBs, qbStreamingWeek } = useTypedLoaderData<typeof loader>();
  const navigation = useNavigation();

  if (!qbStreamingWeek) throw new Error('No information found for week');

  return (
    <div>
      <h2>Edit Picks for Week</h2>
      {actionData?.message && <Alert message={actionData.message} />}
      <Form method='POST'>
        <h3>Add Player</h3>
        <div>
          <select
            name='playerId'
            className='form-select mt-1 block w-full dark:border-0 dark:bg-slate-800'
          >
            {activeQBs.map(qb => (
              <option key={qb.id} value={qb.id}>
                {qb.lastName}, {qb.firstName}: {qb.nflTeam}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor='isDeep'>
            <input
              type='checkbox'
              name='isDeep'
              id='isDeep'
              defaultChecked={true}
            />{' '}
            Available in both player pools
          </label>
        </div>
        <div className='pt-4'>
          <Button
            type='submit'
            name='_action'
            value='addPlayer'
            disabled={navigation.state !== 'idle'}
          >
            Add Player
          </Button>
        </div>
      </Form>
      <h3>Available Players</h3>
      <table className='w-full'>
        <thead>
          <tr>
            <th>Player</th>
            <th>Team</th>
            <th>Both Pools?</th>
            <th>Points</th>
            <th>Remove</th>
          </tr>
        </thead>
        <tbody>
          {qbStreamingWeek.QBStreamingWeekOptions.map(qbStreamingWeekOption => (
            <tr key={qbStreamingWeekOption.id}>
              <td>{qbStreamingWeekOption.player.fullName}</td>
              <td>{qbStreamingWeekOption.player.nflTeam}</td>
              <td>{qbStreamingWeekOption.isDeep ? 'Yes' : 'No'}</td>
              <td>{qbStreamingWeekOption.pointsScored}</td>
              <td>
                <Form method='POST'>
                  <input
                    type='hidden'
                    name='qbStreamingWeekOptionId'
                    value={qbStreamingWeekOption.id}
                  />
                  <Button
                    type='submit'
                    name='_action'
                    value='removePlayer'
                    disabled={navigation.state !== 'idle'}
                  >
                    Remove
                  </Button>
                </Form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>Week Settings</h3>
      <Form method='POST'>
        <label htmlFor='isOpen'>
          <input
            type='checkbox'
            name='isOpen'
            id='isOpen'
            defaultChecked={qbStreamingWeek.isOpen}
          />{' '}
          Week is active for selections
        </label>
        <div>
          <Button
            type='submit'
            name='_action'
            value='updateWeek'
            disabled={navigation.state !== 'idle'}
          >
            Update Week
          </Button>
        </div>
      </Form>
    </div>
  );
}
