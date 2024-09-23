import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form } from '@remix-run/react';
import {
  typedjson,
  useTypedActionData,
  useTypedLoaderData,
} from 'remix-typedjson';
import Alert from '~/components/ui/Alert';
import Button from '~/components/ui/Button';
import type { ScoreArray } from '~/models/cup.server';
import { getCup } from '~/models/cup.server';
import type { CupGame } from '~/models/cupgame.server';
import {
  createCupGame,
  getCupGamesByCup,
  updateCupGame,
} from '~/models/cupgame.server';
import {
  type CupTeam,
  createCupTeam,
  getCupTeamsByCup,
} from '~/models/cupteam.server';
import type { CupWeek } from '~/models/cupweek.server';
import { getCupWeeks, updateCupWeek } from '~/models/cupweek.server';
import { getCurrentSeason } from '~/models/season.server';
import {
  getTeamGameMultiweekTotals,
  getTeamGameMultiweekTotalsSeparated,
} from '~/models/teamgame.server';
import { authenticator, requireAdmin } from '~/services/auth.server';

type CupMappingOptions = {
  label: string;
  value:
    | 'PENDING'
    | 'SEEDING'
    | 'ROUND_OF_64'
    | 'ROUND_OF_32'
    | 'ROUND_OF_16'
    | 'ROUND_OF_8'
    | 'ROUND_OF_4'
    | 'ROUND_OF_2';
};

const selectOptions: CupMappingOptions[] = [
  {
    label: 'Pending',
    value: 'PENDING',
  },
  {
    label: 'Seeding Week',
    value: 'SEEDING',
  },
  {
    label: 'Round of 64',
    value: 'ROUND_OF_64',
  },
  {
    label: 'Round of 32',
    value: 'ROUND_OF_32',
  },
  {
    label: 'Round of 16',
    value: 'ROUND_OF_16',
  },
  {
    label: 'Quarterfinals',
    value: 'ROUND_OF_8',
  },
  {
    label: 'Semifinals',
    value: 'ROUND_OF_4',
  },
  {
    label: 'Finals',
    value: 'ROUND_OF_2',
  },
];

const rounds = [
  'ROUND_OF_2',
  'ROUND_OF_4',
  'ROUND_OF_8',
  'ROUND_OF_16',
  'ROUND_OF_32',
  'ROUND_OF_64',
];
const roundOf64Matches = [
  [1, 64],
  [32, 33],
  [17, 48],
  [16, 49],
  [9, 56],
  [24, 41],
  [25, 40],
  [8, 57],
  [4, 61],
  [29, 36],
  [20, 45],
  [13, 52],
  [12, 53],
  [21, 44],
  [28, 37],
  [5, 60],
  [2, 63],
  [31, 34],
  [18, 47],
  [15, 50],
  [10, 55],
  [23, 42],
  [26, 39],
  [7, 58],
  [3, 62],
  [30, 35],
  [19, 46],
  [14, 51],
  [11, 54],
  [22, 43],
  [27, 38],
  [6, 59],
];

export const action = async ({ params, request }: ActionFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  const cupId = params.id;
  if (!cupId) throw new Error('Missing cup id');

  const cup = await getCup(cupId);
  if (!cup) throw new Error('Invalid cup');

  const formData = await request.formData();
  const action = formData.get('_action');

  const currentSeason = await getCurrentSeason();
  if (!currentSeason) throw new Error('No current season');

  switch (action) {
    case 'updateCup': {
      const promises: Promise<CupWeek>[] = [];
      for (const [key, mapping] of formData.entries()) {
        const id = key.replace('week-', '');

        if (id === '_action') {
          continue;
        }

        if (mapping && typeof mapping === 'string') {
          promises.push(updateCupWeek(id, { mapping }));
        }
      }
      await Promise.all(promises);

      return typedjson({
        message: 'Cup week mappings have been updated.',
      });
    }
    case 'SEEDING': {
      const weeksToScore = (await getCupWeeks(cupId))
        .filter(cupWeek => cupWeek.mapping === 'SEEDING')
        .map(cupWeek => cupWeek.week);

      const scores = await getTeamGameMultiweekTotals(
        weeksToScore,
        currentSeason?.year,
      );
      const promises: Promise<CupTeam>[] = [];
      let seed = 1;
      for (const { teamId } of scores) {
        console.log({
          cupId,
          teamId,
          seed,
        });
        promises.push(
          createCupTeam({
            cupId,
            teamId,
            seed,
          }),
        );
        seed++;
      }
      await Promise.all(promises);

      // Get all the teams now, we'll need this to reference later
      const cupTeams = await getCupTeamsByCup(cup.id);

      // Create all the matches
      const lastRoundMatchIds = [];
      for (const [index, round] of rounds.entries()) {
        const matchIdsToLoop = [...lastRoundMatchIds];
        lastRoundMatchIds.length = 0;

        const numberOfMatchesToCreate = Math.pow(2, index);

        if (numberOfMatchesToCreate === 1) {
          const cupGame = await createCupGame({
            cupId: cup.id,
            round,
            roundSort: index,
            insideRoundSort: 0,
            winnerToTop: false,
            topTeamId: null,
            bottomTeamId: null,
            winningTeamId: null,
            losingTeamId: null,
            winnerToGameId: null,
            containsBye: false,
          });
          lastRoundMatchIds.push(cupGame.id);
        } else if (numberOfMatchesToCreate !== 32) {
          for (let i = 0; i < numberOfMatchesToCreate; i += 2) {
            const prevIndex = i / 2;
            const upperCupGame: CupGame = await createCupGame({
              cupId: cup.id,
              round,
              roundSort: index,
              insideRoundSort: i,
              winnerToTop: true,
              topTeamId: null,
              bottomTeamId: null,
              winningTeamId: null,
              losingTeamId: null,
              winnerToGameId: matchIdsToLoop[prevIndex],
              containsBye: false,
            });
            const lowerCupGame: CupGame = await createCupGame({
              cupId: cup.id,
              round,
              roundSort: index,
              insideRoundSort: i + 1,
              winnerToTop: false,
              topTeamId: null,
              bottomTeamId: null,
              winningTeamId: null,
              losingTeamId: null,
              winnerToGameId: matchIdsToLoop[prevIndex],
              containsBye: false,
            });
            lastRoundMatchIds.push(upperCupGame.id, lowerCupGame.id);
          }
        } else {
          for (let i = 0; i < numberOfMatchesToCreate; i += 2) {
            const prevIndex = i / 2;
            const getMatchOne = roundOf64Matches[i];
            const getMatchTwo = roundOf64Matches[i + 1];
            const upperCupGame: CupGame = await createCupGame({
              cupId: cup.id,
              round,
              roundSort: index,
              insideRoundSort: i,
              winnerToTop: true,
              topTeamId:
                cupTeams.find(cupTeam => cupTeam.seed === getMatchOne[0])?.id ||
                null,
              bottomTeamId:
                cupTeams.find(cupTeam => cupTeam.seed === getMatchOne[1])?.id ||
                null,
              winningTeamId: null,
              losingTeamId: null,
              winnerToGameId: matchIdsToLoop[prevIndex],
              containsBye: cupTeams.find(
                cupTeam => cupTeam.seed === getMatchOne[1],
              )?.id
                ? false
                : true,
            });
            const lowerCupGame: CupGame = await createCupGame({
              cupId: cup.id,
              round,
              roundSort: index,
              insideRoundSort: i + 1,
              winnerToTop: false,
              topTeamId:
                cupTeams.find(cupTeam => cupTeam.seed === getMatchTwo[0])?.id ||
                null,
              bottomTeamId:
                cupTeams.find(cupTeam => cupTeam.seed === getMatchTwo[1])?.id ||
                null,
              winningTeamId: null,
              losingTeamId: null,
              winnerToGameId: matchIdsToLoop[prevIndex],
              containsBye: cupTeams.find(
                cupTeam => cupTeam.seed === getMatchTwo[1],
              )?.id
                ? false
                : true,
            });
            lastRoundMatchIds.push(upperCupGame.id, lowerCupGame.id);
          }
        }
      }

      // Automatically advance bye winners for round one.
      const cupGamesWithBye = (await getCupGamesByCup(cup.id)).filter(
        cupGame => cupGame.containsBye,
      );

      const updates: Promise<CupGame>[] = [];
      for (const cupGame of cupGamesWithBye) {
        updates.push(
          updateCupGame(cupGame.id, {
            id: cupGame.id,
            winningTeamId: cupGame.topTeamId,
          }),
        );
        // We won't do this for the final, but this is byes so whatever
        const updateCupGameData: Partial<CupGame> = {
          id: cupGame.winnerToGameId!,
        };
        if (cupGame.winnerToTop) {
          updateCupGameData.topTeamId = cupGame.topTeamId;
        } else {
          updateCupGameData.bottomTeamId = cupGame.topTeamId;
        }
        updates.push(updateCupGame(cupGame.winnerToGameId!, updateCupGameData));
      }
      await Promise.all(updates);

      return typedjson({
        message: 'Seeding created.',
      });
    }
    default: {
      const cupWeeks = (await getCupWeeks(cup.id)).filter(
        cupWeek => cupWeek.mapping === action,
      );

      const cupGames = (await getCupGamesByCup(cup.id)).filter(
        cupGame => cupGame.round === action,
      );

      const scores = await getTeamGameMultiweekTotalsSeparated(
        cupWeeks.map(cupWeek => cupWeek.week),
      );

      const scoreArray: ScoreArray[] = [];
      for (const score of scores) {
        const roundToAddTo = cupWeeks.find(
          cupWeek => cupWeek.week === score.week,
        );
        if (!roundToAddTo) {
          continue;
        }
        const index = scoreArray.findIndex(
          player =>
            player.teamId === score.teamId &&
            player.mapping === roundToAddTo.mapping,
        );
        if (index !== -1) {
          scoreArray[index]['pointsScored'] += score.pointsScored;
        } else {
          scoreArray.push({
            teamId: score.teamId,
            mapping: roundToAddTo.mapping,
            pointsScored: score.pointsScored,
          });
        }
      }

      const promises: Promise<CupGame>[] = [];
      for (const cupGame of cupGames) {
        if (cupGame.containsBye) {
          continue;
        }
        const tiebreaker =
          !cupGame.bottomTeam ||
          cupGame.topTeam!.seed > cupGame.bottomTeam!.seed
            ? 0.001
            : -0.001;
        const topTeamScore =
          (scoreArray.find(
            scoreObject => scoreObject.teamId === cupGame.topTeam?.teamId,
          )?.pointsScored || 0) + tiebreaker;
        const bottomTeamScore =
          scoreArray.find(
            scoreObject => scoreObject.teamId === cupGame.bottomTeam?.teamId,
          )?.pointsScored || 0;
        const [winningTeamId, losingTeamId] =
          topTeamScore > bottomTeamScore
            ? [cupGame.topTeamId, cupGame.bottomTeamId]
            : [cupGame.bottomTeamId, cupGame.topTeamId];
        promises.push(
          updateCupGame(cupGame.id, {
            id: cupGame.id,
            winningTeamId,
            losingTeamId,
          }),
        );
        if (cupGame.winnerToTop && cupGame.winnerToGameId) {
          promises.push(
            updateCupGame(cupGame.winnerToGameId!, {
              id: cupGame.winnerToGameId,
              topTeamId: winningTeamId,
            }),
          );
        } else if (cupGame.winnerToGameId) {
          promises.push(
            updateCupGame(cupGame.winnerToGameId!, {
              id: cupGame.winnerToGameId,
              bottomTeamId: winningTeamId,
            }),
          );
        }
      }
      await Promise.all(promises);

      return typedjson({
        message: 'This week was scored.',
      });
    }
  }
};

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  const id = params.id;
  if (!id) throw new Error('Missing ID');

  const cup = await getCup(id);
  if (!cup) throw new Error('No cup found');

  const cupWeeks = await getCupWeeks(cup.id);

  const actionWeeks: Map<string, number> = new Map();

  for (const cupWeek of cupWeeks) {
    const existingValue = actionWeeks.get(cupWeek.mapping);
    if (!existingValue || existingValue < cupWeek.week) {
      actionWeeks.set(cupWeek.mapping, cupWeek.week);
    }
  }

  return typedjson({ cup, cupWeeks, actionWeeks });
};

export default function CupAdministerPage() {
  const actionData = useTypedActionData<typeof action>();
  const { cup, cupWeeks, actionWeeks } = useTypedLoaderData<typeof loader>();

  return (
    <>
      <h2>Administer {cup.year} Cup</h2>
      {actionData?.message && <Alert message={actionData.message} />}
      <Form method='POST' reloadDocument>
        <table>
          <thead>
            <tr>
              <th>Week</th>
              <th>Map</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {cupWeeks.map((cupWeek, index) => {
              const action =
                actionWeeks.get(cupWeek.mapping) === cupWeek.week
                  ? cupWeek.mapping
                  : undefined;
              const buttonText =
                action === 'SEEDING' ? 'Set Seeds' : 'Score Week';

              return (
                <tr key={cupWeek.id}>
                  <td>{cupWeek.week}</td>
                  <td>
                    <select
                      name={`week-${cupWeek.id}`}
                      id={`week-${cupWeek.id}`}
                      defaultValue={cupWeek.mapping}
                      className='form-select dark:border-0 dark:bg-slate-800'
                    >
                      {selectOptions.map(option => (
                        <option value={option.value} key={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {action && (
                      <Button
                        type='submit'
                        name='_action'
                        value={cupWeek.mapping}
                      >
                        {buttonText}
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div>
          <Button type='submit' name='_action' value='updateCup'>
            Update Mapping
          </Button>
        </div>
      </Form>
    </>
  );
}
