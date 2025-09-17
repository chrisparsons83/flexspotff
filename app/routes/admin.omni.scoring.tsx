import type { OmniPlayer } from '@prisma/client';
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form, useNavigation } from '@remix-run/react';
import clsx from 'clsx';
import type { APIEmbedField, RestOrArray } from 'discord.js';
import { EmbedBuilder } from 'discord.js';
import type { ChangeEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  typedjson,
  useTypedActionData,
  useTypedLoaderData,
} from 'remix-typedjson';
import { sendMessageToChannel } from '~/../bot/utils';
import Alert from '~/components/ui/Alert';
import Button from '~/components/ui/FlexSpotButton';
import {
  getPlayersAndAssociatedPick,
  updateOmniPlayer,
} from '~/models/omniplayer.server';
import type { OmniScoreCreate } from '~/models/omniscore.server';
import { createOmniScore } from '~/models/omniscore.server';
import { getOmniSeason } from '~/models/omniseason.server';
import { getActiveSports } from '~/models/omnisport.server';
import { authenticator, requireAdmin } from '~/services/auth.server';
import { envSchema } from '~/utils/helpers';

const OMNI_YEAR = 2025;
const env = envSchema.parse(process.env);

interface DiscordScoringUpdate {
  id: string;
  existingScore: number;
  pointsAdded: number;
  isEliminated: boolean;
  discordId?: string;
}

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
      const scoringUpdatesToSendToDiscord: DiscordScoringUpdate[] = [];
      for (const [id, data] of updates) {
        const existingScore =
          players.find(player => player.id === id)?.pointsScored || 0;
        if (Number(data.pointsAdded) > 0 || data.isEliminated === 'on') {
          scoringUpdatesToSendToDiscord.push({
            id,
            existingScore,
            pointsAdded: Number(data.pointsAdded),
            isEliminated: data.isEliminated === 'on' ? true : false,
            discordId: players.find(player => player.id === id)?.draftPick?.team
              .user?.discordId,
          });
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

      if (
        typeof env.OMNI_CHANNEL_ID === 'string' &&
        scoringUpdatesToSendToDiscord.length > 0
      ) {
        const sport = await getActiveSports().then(sports =>
          sports.find(sport => sport.id === sportId),
        );
        if (!sport) {
          throw new Error('Sport not found.');
        }

        const pointsAwarded = scoringUpdatesToSendToDiscord.filter(
          update => update.pointsAdded > 0,
        );
        const teamsCompleted = scoringUpdatesToSendToDiscord.filter(
          update => update.isEliminated,
        );

        const fields: RestOrArray<APIEmbedField> = [];
        if (pointsAwarded.length > 0) {
          fields.push({
            name: 'Points awarded',
            value: pointsAwarded
              .map(update => {
                const player = players.find(p => p.id === update.id);
                if (!player) return '';
                return `${player.displayName} (<@${
                  player.draftPick?.team.user?.discordId
                }>): +${update.pointsAdded} (${
                  update.pointsAdded + update.existingScore
                } total)`;
              })
              .join('\n'),
          });
        }
        if (teamsCompleted.length > 0) {
          fields.push({
            name: 'Teams Completed',
            value: teamsCompleted
              .map(update => {
                const player = players.find(p => p.id === update.id);
                if (!player) return '';
                return `${player.displayName} (<@${
                  player.draftPick?.team.user?.discordId
                }>): ${update.pointsAdded + update.existingScore} points`;
              })
              .join('\n'),
          });
        }

        const embed = new EmbedBuilder()
          .setTitle(`${sport.emoji} Scores Updated`)
          .setDescription(
            `The following scores have been updated in ${sport.name}`,
          )
          .addFields(fields);

        const uniqueUsers = [
          ...new Set(
            [...teamsCompleted, ...pointsAwarded]
              .map(team => team.discordId)
              .filter(discordId => discordId !== undefined),
          ),
        ];

        // Get the content text based on whether we're pinging everyone or specific users
        let contentText;
        if (
          uniqueUsers.length ===
          players.filter(
            player => player && player.draftPick?.team.user?.discordId,
          ).length
        ) {
          // If uniqueUsers includes all players in the league, ping the role instead of individuals
          contentText = env.OMNI_ROLE_ID
            ? `Scoring update for <@&${env.OMNI_ROLE_ID}>`
            : 'Scoring update for everyone';
        } else {
          // Otherwise ping specific users
          contentText = `Scoring update for ${uniqueUsers
            .map(discordId => `<@${discordId}>`)
            .join(', ')}`;
        }

        await sendMessageToChannel({
          channelId: env.OMNI_CHANNEL_ID,
          messageData: {
            content: contentText,
            embeds: [embed],
          },
        });
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
  const [allChecked, setAllChecked] = useState(false);
  const [useInputField, setUseInputField] = useState(false);
  const { sports, players } = useTypedLoaderData<typeof loader>();
  const actionData = useTypedActionData<typeof action>();
  const navigation = useNavigation();

  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (navigation.state === 'idle') {
      formRef.current?.reset();
      document.documentElement.scrollTo({
        top: 0,
        left: 0,
        behavior: 'instant', // Optional if you want to skip the scrolling animation
      });
      // Restore sportId after reset
      setTimeout(() => {
        const sportIdInput = formRef.current?.elements.namedItem(
          'sportId',
        ) as HTMLInputElement;
        if (sportIdInput) {
          sportIdInput.value = activeSport; // Restore sportId value
        }
      }, 0);
    }
  }, [activeSport, navigation.state]);

  const handleChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setActiveSport(e.target.value);
    setAllChecked(false);
    setUseInputField(false);
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

  const toggleInputMode = () => {
    setUseInputField(!useInputField);
  };

  return (
    <div>
      <h2>Adjust Scoring</h2>
      {actionData?.message && <Alert message={actionData.message} />}
      <Form method='POST' ref={formRef} preventScrollReset={true}>
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
            <div className='mb-4 flex gap-2'>
              <Button
                type='button'
                onClick={toggleAllCheckboxes}
                className='bg-gray-100 text-gray-900 hover:bg-gray-200'
              >
                {allChecked ? 'Clear Checkboxes' : 'Select All Players'}
              </Button>
              <Button
                type='button'
                onClick={toggleInputMode}
                className='bg-gray-100 text-gray-900 hover:bg-gray-200'
              >
                {useInputField ? 'Use Dropdown' : 'Use Custom Values'}
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
                        <td className='not-prose px-4'>
                          <div>{player.displayName}</div>
                        </td>
                        <td>{player.pointsScored}</td>
                        <td>
                          {useInputField ? (
                            <input
                              type='number'
                              name={`${player.id}--pointsAdded`}
                              defaultValue='0'
                              min='0'
                              className='form-input block w-full dark:border-0 dark:bg-slate-600'
                            />
                          ) : (
                            <select
                              name={`${player.id}--pointsAdded`}
                              className='form-select block w-full dark:border-0 dark:bg-slate-600'
                            >
                              <option value='0'>0</option>
                              <option value='10'>10</option>
                              <option value='20'>20</option>
                              <option value='30'>30</option>
                            </select>
                          )}
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
                        <td className='not-prose px-4'>{player.displayName}</td>
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
