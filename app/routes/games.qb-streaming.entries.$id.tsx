import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form, useNavigation } from '@remix-run/react';
import {
  typedjson,
  useTypedActionData,
  useTypedLoaderData,
} from 'remix-typedjson';
import Alert from '~/components/ui/Alert';
import Button from '~/components/ui/FlexSpotButton';
import { getNflGameById } from '~/models/nflgame.server';
import type { QBSelection } from '~/models/qbselection.server';
import {
  createQBSelection,
  getQBSelection,
  updateQBSelection,
} from '~/models/qbselection.server';
import { getQBStreamingWeek } from '~/models/qbstreamingweek.server';
import { authenticator } from '~/services/auth.server';

export const action = async ({ params, request }: ActionFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });

  const qbStreamingWeekId = params.id;
  if (!qbStreamingWeekId) throw new Error('Missing streaming week id');

  const currentWeek = await getQBStreamingWeek(qbStreamingWeekId);
  if (!currentWeek) throw new Error('Week does not exist');

  const existingSelection = await getQBSelection(qbStreamingWeekId, user.id);
  const newSelections: Partial<
    Pick<QBSelection, 'standardPlayerId' | 'deepPlayerId'>
  > = {};

  const formData = await request.formData();
  const standardPlayerId = formData.get('standardPlayerId');
  if (typeof standardPlayerId !== 'string') {
    throw new Error('Bad form submit for standardPlayerId');
  }
  const deepPlayerId = formData.get('deepPlayerId');
  if (typeof deepPlayerId !== 'string') {
    throw new Error('Bad form submit for deepPlayerId');
  }

  // Helper function to validate and get player selection
  const validatePlayerSelection = async (
    submittedPlayerId: string,
    existingPlayerId: string | null,
    existingPlayerGame: { gameStartTime: Date } | null,
    selectionType: 'standard' | 'deep',
  ): Promise<string> => {
    // If user has an existing selection and it's locked, keep the existing value
    if (existingPlayerId && existingPlayerGame) {
      const existingIsLocked = existingPlayerGame.gameStartTime < new Date();

      if (existingIsLocked) {
        // Selection is locked, ignore submitted value and return existing
        return existingPlayerId;
      }
    }

    // Selection is either unlocked or doesn't exist yet - validate the new selection
    const qbStreamingOption = currentWeek.QBStreamingWeekOptions.find(
      option => option.id === submittedPlayerId,
    );
    if (!qbStreamingOption) {
      throw new Error(`${selectionType === 'standard' ? 'Standard' : 'Deep'} QB Streaming Option not found`);
    }

    const nflGame = await getNflGameById(qbStreamingOption.nflGameId);
    if (!nflGame) throw new Error('Game not found');

    if (nflGame.gameStartTime > new Date()) {
      return submittedPlayerId;
    } else {
      throw new Error(
        `Cannot select a ${selectionType} player whose game has already started`,
      );
    }
  };

  // Validate both selections
  newSelections.standardPlayerId = await validatePlayerSelection(
    standardPlayerId,
    existingSelection?.standardPlayerId ?? null,
    existingSelection?.standardPlayer.nflGame ?? null,
    'standard',
  );

  newSelections.deepPlayerId = await validatePlayerSelection(
    deepPlayerId,
    existingSelection?.deepPlayerId ?? null,
    existingSelection?.deepPlayer.nflGame ?? null,
    'deep',
  );

  // Update or create selection
  if (existingSelection) {
    await updateQBSelection({
      id: existingSelection.id,
      qbStreamingWeekId: existingSelection.qbStreamingWeekId,
      standardPlayerId: existingSelection.standardPlayerId,
      deepPlayerId: existingSelection.deepPlayerId,
      userId: existingSelection.userId,
      ...newSelections,
    });
    return typedjson({ message: 'Your picks have been updated.' });
  } else {
    if (!newSelections.standardPlayerId)
      throw new Error('No new standard player ID');
    if (!newSelections.deepPlayerId) throw new Error('No new deep player ID');
    await createQBSelection({
      userId: user.id,
      standardPlayerId: newSelections.standardPlayerId,
      deepPlayerId: newSelections.deepPlayerId,
      qbStreamingWeekId,
    });
    return typedjson({ message: 'Your picks have been created.' });
  }
};

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });

  const id = params.id;
  if (!id) throw new Error(`No QB streaming week ID found`);

  const qbStreamingWeek = await getQBStreamingWeek(id);
  if (!qbStreamingWeek) throw new Error(`QB Streaming Week ID does not exist`);

  const qbSelection = await getQBSelection(id, user.id);

  return typedjson({ user, qbStreamingWeek, qbSelection });
};

export default function QBStreamingYearWeekEntry() {
  const actionData = useTypedActionData<typeof action>();
  const { qbStreamingWeek, qbSelection } = useTypedLoaderData<typeof loader>();
  const navigation = useNavigation();

  const standardIsLocked =
    !!qbSelection &&
    qbSelection?.standardPlayer.nflGame.gameStartTime < new Date();
  const deepIsLocked =
    !!qbSelection &&
    qbSelection?.deepPlayer.nflGame.gameStartTime < new Date();

  return (
    <>
      <h2>Edit Streaming Picks for Week {qbStreamingWeek?.week}</h2>
      {actionData?.message && <Alert message={actionData.message} />}
      <Form method='POST'>
        <div className='mb-4'>
          <label htmlFor='standardPlayerId'>
            Standard Selection:
            {standardIsLocked && qbSelection?.standardPlayerId && (
              <input
                type='hidden'
                name='standardPlayerId'
                value={qbSelection.standardPlayerId}
              />
            )}
            <select
              defaultValue={qbSelection?.standardPlayerId}
              name={standardIsLocked ? undefined : 'standardPlayerId'}
              id='standardPlayerId'
              required={!standardIsLocked}
              className='form-select mt-1 block w-full dark:border-0 dark:bg-slate-800'
              disabled={standardIsLocked}
            >
              <option value=''></option>
              {qbStreamingWeek?.QBStreamingWeekOptions.map(qbOption => {
                const matchup =
                  qbOption.player.currentNFLTeamId ===
                  qbOption.nflGame.homeTeamId
                    ? `vs ${qbOption.nflGame.awayTeam.mascot}`
                    : `@ ${qbOption.nflGame.homeTeam.mascot}`;

                return (
                  <option
                    key={qbOption.id}
                    value={qbOption.id}
                    disabled={qbOption.nflGame.gameStartTime < new Date()}
                  >
                    {qbOption.player.fullName} {matchup}
                  </option>
                );
              })}
            </select>
          </label>
        </div>
        <div className='mb-4'>
          <label htmlFor='deepPlayerId'>
            Deep Selection:
            {deepIsLocked && qbSelection?.deepPlayerId && (
              <input
                type='hidden'
                name='deepPlayerId'
                value={qbSelection.deepPlayerId}
              />
            )}
            <select
              defaultValue={qbSelection?.deepPlayerId}
              name={deepIsLocked ? undefined : 'deepPlayerId'}
              id='deepPlayerId'
              required={!deepIsLocked}
              className='form-select mt-1 block w-full dark:border-0 dark:bg-slate-800'
              disabled={deepIsLocked}
            >
              <option value=''></option>
              {qbStreamingWeek?.QBStreamingWeekOptions.filter(
                qbOption => qbOption.isDeep,
              ).map(qbOption => {
                const matchup =
                  qbOption.player.currentNFLTeamId ===
                  qbOption.nflGame.homeTeamId
                    ? `vs ${qbOption.nflGame.awayTeam.mascot}`
                    : `@ ${qbOption.nflGame.homeTeam.mascot}`;

                return (
                  <option
                    key={qbOption.id}
                    value={qbOption.id}
                    disabled={qbOption.nflGame.gameStartTime < new Date()}
                  >
                    {qbOption.player.fullName} {matchup}
                  </option>
                );
              })}
            </select>
          </label>
        </div>
        <div>
          <Button
            type='submit'
            name='_action'
            value='saveOptions'
            disabled={navigation.state !== 'idle'}
          >
            Update Entry
          </Button>
        </div>
      </Form>
    </>
  );
}
