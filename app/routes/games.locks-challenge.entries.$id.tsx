import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form, useNavigation } from '@remix-run/react';
import { useState } from 'react';
import {
  typedjson,
  useTypedActionData,
  useTypedLoaderData,
} from 'remix-typedjson';
import LocksChallengeGameComponent from '~/components/layout/locks-challenge/LocksChallengeGame';
import Alert from '~/components/ui/Alert';
import Button from '~/components/ui/FlexSpotButton';
import type { TeamPick } from '~/models/locksgame.server';
import { getLocksGamesByYearAndWeek } from '~/models/locksgame.server';
import type { LocksGamePickCreate } from '~/models/locksgamepicks.server';
import {
  createLocksGamePicks,
  deleteLocksGamePicksForUserAndWeek,
  getLocksGamePicksByUserAndLocksWeek,
} from '~/models/locksgamepicks.server';
import { getLocksWeek } from '~/models/locksweek.server';
import { getCurrentSeason } from '~/models/season.server';
import { authenticator } from '~/services/auth.server';

export const action = async ({ params, request }: ActionFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });

  let currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    throw new Error('No active season currently');
  }

  const locksWeekId = params.id;
  if (!locksWeekId) throw new Error(`No locks week ID set`);

  const locksWeek = await getLocksWeek(locksWeekId);
  if (!locksWeek) throw new Error(`Missing locks week.`);
  const locksGames = await getLocksGamesByYearAndWeek(
    locksWeek.year,
    locksWeek.weekNumber,
  );

  // Create list to hold all selected teams
  const nflTeamsPicked: string[] = [];

  // Update map with existing bets
  const existingPicks = await getLocksGamePicksByUserAndLocksWeek(
    user,
    locksWeek,
  );
  for (const existingPick of existingPicks) {
    if (existingPick.isActive > 0) {
      nflTeamsPicked.push(
        `${existingPick.locksGameId}-${existingPick.teamBetId}`,
      );
    }
  }

  // Update map with new picks that are eligible
  const newPicksForm = await request.formData();
  for (const [key, amount] of newPicksForm.entries()) {
    const [locksGameId, teamBetId] = key.split('-');
    const locksGame = locksGames.find(
      locksGame => locksGame.id === locksGameId,
    );
    if (!locksGame) continue;

    // If no team is bet then remove the game from the list
    if (!teamBetId || teamBetId === 'undefined') {
      if (nflTeamsPicked.some(item => item.includes(`${locksGameId}`))) {
        // Remove the game from the list
        nflTeamsPicked.splice(
          nflTeamsPicked.findIndex(item => item.includes(`${locksGameId}`)),
          1,
        );
      }
    }

    if (locksGame.game.gameStartTime > new Date()) {
      // If isActive flag is 0 then do not add to nflTeamsPicked
      if (amount !== '0') {
        //If homeTeam is bet on previously and the awayTeam is selected
        if (
          nflTeamsPicked.includes(
            `${locksGameId}-${locksGame.game.homeTeamId}`,
          ) &&
          teamBetId === locksGame.game.awayTeamId
        ) {
          nflTeamsPicked.splice(
            nflTeamsPicked.findIndex(
              item => item === `${locksGameId}-${locksGame.game.homeTeamId}`,
            ),
            1,
          );
          nflTeamsPicked.push(`${locksGameId}-${teamBetId}`);
        }
        //If awayTeam is bet on previously and the homeTeam is selected
        if (
          nflTeamsPicked.includes(
            `${locksGameId}-${locksGame.game.awayTeamId}`,
          ) &&
          teamBetId === locksGame.game.homeTeamId
        ) {
          nflTeamsPicked.splice(
            nflTeamsPicked.findIndex(
              item => item === `${locksGameId}-${locksGame.game.awayTeamId}`,
            ),
            1,
          );
          nflTeamsPicked.push(`${locksGameId}-${teamBetId}`);
        } else {
          if (!nflTeamsPicked.includes(`${locksGameId}-${teamBetId}`)) {
            nflTeamsPicked.push(`${locksGameId}-${teamBetId}`);
          }
        }
      }
    }
  }

  // Loop through map and build promises to send down for creates
  const dataToInsert: LocksGamePickCreate[] = [];
  for (const [, picked] of nflTeamsPicked.entries()) {
    const [locksGameId, teamBetId] = picked.split('-');
    const locksGame = locksGames.find(
      locksGame => locksGame.id === locksGameId,
    );
    let otherTeamId =
      teamBetId === locksGame?.game.homeTeamId
        ? locksGame?.game.awayTeamId
        : locksGame?.game.homeTeamId;
    dataToInsert.push({
      userId: user.id,
      isScored: false,
      isLoss: 0,
      isTie: 0,
      isWin: 0,
      teamBetId: teamBetId,
      locksGameId: locksGameId,
      isActive: 1,
    });

    dataToInsert.push({
      userId: user.id,
      isScored: false,
      isLoss: 0,
      isTie: 0,
      isWin: 0,
      teamBetId: otherTeamId || '',
      locksGameId: locksGameId,
      isActive: 0,
    });
  }

  // Find all the locksGame that were not created and add them to the data as inactive
  for (const locksGame of locksGames) {
    // Check if the locksGame was created
    if (!(nflTeamsPicked.filter(id => id.includes(locksGame.id)).length > 0)) {
      // Push the data as inactive
      dataToInsert.push({
        userId: user.id,
        isScored: false,
        isLoss: 0,
        isTie: 0,
        isWin: 0,
        teamBetId: locksGame.game.homeTeamId,
        locksGameId: locksGame.id,
        isActive: 0,
      });

      dataToInsert.push({
        userId: user.id,
        isScored: false,
        isLoss: 0,
        isTie: 0,
        isWin: 0,
        teamBetId: locksGame.game.awayTeamId,
        locksGameId: locksGame.id,
        isActive: 0,
      });
    }
  }

  // Delete existing bets and wholesale replace them with the insert
  // I think this is actually quicker than upserting and there's no harm in recreating this data
  await deleteLocksGamePicksForUserAndWeek(user, locksWeek);
  await createLocksGamePicks(dataToInsert);

  return typedjson({ message: 'Your picks have been saved.' });
};

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });

  let currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    throw new Error('No active season currently');
  }

  const locksWeekId = params.id;
  if (!locksWeekId) throw new Error(`No locks week ID set`);

  const locksWeek = await getLocksWeek(locksWeekId);

  if (!locksWeek) {
    return typedjson({
      notOpenYet: 'Week has not been created yet.',
      locksWeek,
      locksGames: [],
      locksGamePicks: [],
      weekNumber: locksWeekId,
    });
  }
  if (!locksWeek.isOpen) {
    return typedjson({
      notOpenYet: 'Week is not open yet (Blame Chris)',
      locksWeek,
      locksGames: [],
      locksGamePicks: [],
      weekNumber: locksWeekId,
    });
  }

  const locksGamePicks = await getLocksGamePicksByUserAndLocksWeek(
    user,
    locksWeek,
  );

  const locksGames = await getLocksGamesByYearAndWeek(
    locksWeek.year,
    locksWeek.weekNumber,
  );

  const weekNumber = locksWeek.weekNumber;

  return typedjson(
    {
      notOpenYet: false,
      locksWeek,
      locksGames,
      locksGamePicks,
      weekNumber,
    },
    { headers: { 'x-superjson': 'true' } },
  );
};

export default function GamesLocksChallengeWeek() {
  const actionData = useTypedActionData<typeof action>();
  const { notOpenYet, locksWeek, locksGames, locksGamePicks, weekNumber } =
    useTypedLoaderData<typeof loader>();
  const navigation = useNavigation();

  const existingPicks: TeamPick[] =
    locksGamePicks?.flat().map(lockGame => ({
      teamId: lockGame.teamBetId,
      isActive: lockGame.isActive,
    })) || [];

  const gamesBetOn = existingPicks.filter(pick => pick.isActive === 1).length;

  const [, setPicks] = useState<TeamPick[]>(existingPicks);

  const handleChange = (picks: TeamPick[]) => {
    setPicks(prevPicks => {
      const newBetTeamIds = picks.map(pick => pick.teamId);
      const cleanedBets = prevPicks.filter(
        prevPick => !newBetTeamIds.includes(prevPick.teamId),
      );
      return [...cleanedBets, ...picks];
    });
  };

  const disableSubmit = navigation.state !== 'idle' || locksWeek?.isWeekScored;
  return (
    <>
      <h2>Week {weekNumber} Entry</h2>
      <Form method='POST' reloadDocument>
        {notOpenYet || (
          <>
            {actionData?.message && <Alert message={actionData.message} />}
            <div className='mb-4'>
              <div>Teams Picked: {gamesBetOn}</div>
            </div>
            <div className='md:w-1/2'>
              {locksGames?.map(locksGame => {
                const existingPick = existingPicks.find(
                  existingPick =>
                    [
                      locksGame.game.awayTeamId,
                      locksGame.game.homeTeamId,
                    ].includes(existingPick.teamId) &&
                    existingPick.isActive === 1,
                );
                const existingLocksGamePick = locksGamePicks?.find(
                  locksGamePick =>
                    locksGamePick.teamBetId === existingPick?.teamId,
                );
                return (
                  <LocksChallengeGameComponent
                    key={locksGame.id}
                    handleChange={handleChange}
                    locksGame={locksGame}
                    existingPick={existingPick}
                    existingLocksGamePick={existingLocksGamePick}
                  />
                );
              })}
            </div>
            <div style={{ height: '1em' }}></div>
            <Button
              type='submit'
              disabled={disableSubmit || false}
              className='!ml-0'
            >
              Update Picks
            </Button>
          </>
        )}
      </Form>
    </>
  );
}
