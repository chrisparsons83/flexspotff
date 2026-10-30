import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form, useNavigation } from '@remix-run/react';
import {
  typedjson,
  useTypedActionData,
  useTypedLoaderData,
} from 'remix-typedjson';
import Alert from '~/components/ui/Alert';
import { Button } from '~/components/ui/button';
import { Field } from '~/components/ui/field';
import { Checkbox, NativeSelect } from '~/components/ui/input';
import { Section } from '~/components/ui/section';
import { Table } from '~/components/ui/table';
import { getProjections, getRostership } from '~/libs/sleeper/api.server';
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
  if (!qbStreamingWeekId) throw new Error(`Missing QB streaming week ID`);
  const qbStreamingWeek = await getQBStreamingWeek(qbStreamingWeekId);
  if (!qbStreamingWeek) throw new Error(`QB streaming week does not exist`);

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
      }).catch(error => {
        console.error(`Failed to add player ${playerId}:`, error);
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
    case 'importPlayers': {
      // Get the list of rosterships from sleeper
      const rostershipData = await getRostership(
        qbStreamingWeek.year,
        qbStreamingWeek.week,
      );

      // Filter out the non-QBs
      const activeQBs = await getActivePlayersByPosition('QB');

      // Add rostership data to active QBs
      const activeQBsWithRostership = activeQBs.map(qb => {
        const rostershipInfo = rostershipData[qb.sleeperId];
        return {
          ...qb,
          rostership: rostershipInfo?.owned ?? 0,
        };
      });

      // Sort by rostership and remove all above 50%
      const topQBs = activeQBsWithRostership
        .sort((a, b) => b.rostership - a.rostership)
        .filter(qb => qb.rostership < 50);

      // Get Projects for the QBs
      const projectionData = await getProjections(
        qbStreamingWeek.year,
        qbStreamingWeek.week,
      );

      // Remove QBs from topQBs that are projected below 1 point in half ppr
      const topQBsProjected = topQBs
        .map(qb => {
          const projection = projectionData[qb.sleeperId];
          return {
            ...qb,
            projection,
          };
        })
        .filter(qb => (qb.projection?.pts_half_ppr ?? 0) > 1);

      // Add the QBs to the QB streaming week
      for (const qb of topQBsProjected) {
        const nflGame = await getWeekNflGames(
          qbStreamingWeek.year,
          qbStreamingWeek.week,
        ).then(nflGames =>
          nflGames.find(
            nflGame =>
              nflGame.awayTeamId === qb.currentNFLTeamId ||
              nflGame.homeTeamId === qb.currentNFLTeamId,
          ),
        );

        if (nflGame) {
          await createQBStreamingWeekOption({
            playerId: qb.id,
            isDeep: qb.rostership < 25 ? true : false,
            pointsScored: 0,
            qbStreamingWeekId,
            nflGameId: nflGame.id,
          }).catch(error => {
            console.error(`Failed to add player ${qb.id}:`, error);
          });
        }
      }

      return typedjson({ message: 'Players have been imported.' });
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
  if (!qbStreamingWeekId) throw new Error(`Missing QB streaming week ID`);

  const qbStreamingWeek = await getQBStreamingWeek(qbStreamingWeekId);
  if (!qbStreamingWeek) throw new Error(`QB Streaming week does not exist`);

  const activeQBs = await getActivePlayersByPosition('QB');

  // Filter out players in activeQBs from the qbStreamingWeek
  const filteredQBs = activeQBs.filter(
    qb =>
      !qbStreamingWeek.QBStreamingWeekOptions.find(
        option => option.playerId === qb.id,
      ),
  );

  return typedjson({ filteredQBs, qbStreamingWeek });
};

export default function AdminSpreadPoolYearWeek() {
  const actionData = useTypedActionData<typeof action>();
  const { filteredQBs, qbStreamingWeek } = useTypedLoaderData<typeof loader>();
  const navigation = useNavigation();

  if (!qbStreamingWeek) throw new Error('No information found for week');

  return (
    <Section title='Edit Picks for Week'>
      {actionData?.message && (
        <Alert message={actionData.message} className='mb-6' />
      )}
      <Section as='h3' title='Add Player' className='mt-0'>
        <Form method='POST' className='grid max-w-md gap-6'>
          <Field label='Player'>
            <NativeSelect name='playerId'>
              {filteredQBs.map(qb => (
                <option key={qb.id} value={qb.id}>
                  {qb.lastName}, {qb.firstName}: {qb.nflTeam}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <label className='flex items-center gap-3'>
            <Checkbox name='isDeep' defaultChecked={true} />
            Available in Both Player Pools
          </label>
          <div className='flex flex-wrap gap-3'>
            <Button
              type='submit'
              name='_action'
              value='addPlayer'
              disabled={navigation.state !== 'idle'}
            >
              Add Player
            </Button>
            <Button
              type='submit'
              variant='secondary'
              name='_action'
              value='importPlayers'
              disabled={navigation.state !== 'idle'}
            >
              Import Players
            </Button>
          </div>
        </Form>
      </Section>
      <Section as='h3' title='Available Players'>
        <Table
          headers={['Player', 'Team', 'Both Pools', 'Points', '']}
          numericColumns={[3]}
          primaryColumns={[3]}
        >
          {qbStreamingWeek.QBStreamingWeekOptions.map(qbStreamingWeekOption => (
            <tr key={qbStreamingWeekOption.id}>
              <td>{qbStreamingWeekOption.player.fullName}</td>
              <td>{qbStreamingWeekOption.player.nflTeam}</td>
              <td>{qbStreamingWeekOption.isDeep ? 'Yes' : 'No'}</td>
              <td className='text-right'>
                {qbStreamingWeekOption.pointsScored}
              </td>
              <td>
                <Form method='POST'>
                  <input
                    type='hidden'
                    name='qbStreamingWeekOptionId'
                    value={qbStreamingWeekOption.id}
                  />
                  <Button
                    type='submit'
                    variant='secondary'
                    size='sm'
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
        </Table>
      </Section>
      <Section as='h3' title='Week Settings'>
        <Form method='POST' className='grid gap-6'>
          <label className='flex items-center gap-3'>
            <Checkbox name='isOpen' defaultChecked={qbStreamingWeek.isOpen} />
            Week Is Open for Picks
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
      </Section>
    </Section>
  );
}
