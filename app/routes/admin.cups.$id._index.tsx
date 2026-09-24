import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form } from '@remix-run/react';
import {
  type TypedJsonResponse,
  typedjson,
  useTypedActionData,
  useTypedLoaderData,
} from 'remix-typedjson';
import Alert from '~/components/ui/Alert';
import Button from '~/components/ui/FlexSpotButton';
import type { ChallongeMatchReport } from '~/libs/challonge-cup';
import { importChallongeCup } from '~/libs/challonge-cup-import.server';
import { decideCupGame } from '~/libs/cup-bracket';
import {
  createCupBracket,
  recordCupGameResult,
} from '~/libs/cup-bracket.server';
import type { ScoreArray } from '~/models/cup.server';
import { getCup } from '~/models/cup.server';
import { deleteCupGamesByCup, getCupGamesByCup } from '~/models/cupgame.server';
import {
  type CupTeam,
  createCupTeam,
  deleteCupTeamsByCup,
} from '~/models/cupteam.server';
import type { CupWeek } from '~/models/cupweek.server';
import { getCupWeeks, updateCupWeek } from '~/models/cupweek.server';
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

type ActionData = { message: string; report?: ChallongeMatchReport };

export const action = async ({
  params,
  request,
}: ActionFunctionArgs): Promise<TypedJsonResponse<ActionData>> => {
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

  switch (action) {
    case 'challongePreview':
    case 'challongeImport': {
      const slug = formData.get('slug');
      if (typeof slug !== 'string' || !slug.trim()) {
        return typedjson({ message: 'Enter a Challonge bracket slug.' });
      }

      try {
        const { report, imported } = await importChallongeCup(
          cup,
          slug.trim(),
          { dryRun: action === 'challongePreview' },
        );
        const message = imported
          ? `Imported ${slug} into the ${cup.year} Cup.`
          : report.errors.length > 0
          ? `${slug} can't be imported until the errors below are fixed.`
          : `Preview of ${slug} - nothing has been written yet.`;
        return typedjson({ message, report });
      } catch (error) {
        return typedjson({
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
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
      // Clear existing seeds and games from this cup before generating new ones
      await Promise.all([
        deleteCupTeamsByCup(cupId),
        deleteCupGamesByCup(cupId),
      ]);

      const weeksToScore = (await getCupWeeks(cupId))
        .filter(cupWeek => cupWeek.mapping === 'SEEDING')
        .map(cupWeek => cupWeek.week);

      const scores = await getTeamGameMultiweekTotals(weeksToScore, cup.year);
      const promises: Promise<CupTeam>[] = [];
      let seed = 1;
      for (const { teamId } of scores) {
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

      await createCupBracket(cup.id);

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
        cup.year,
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

      const promises: Promise<void>[] = [];
      for (const cupGame of cupGames) {
        if (cupGame.containsBye) {
          continue;
        }
        const topTeamScore =
          scoreArray.find(
            scoreObject => scoreObject.teamId === cupGame.topTeam?.teamId,
          )?.pointsScored || 0;
        const bottomTeamScore =
          scoreArray.find(
            scoreObject => scoreObject.teamId === cupGame.bottomTeam?.teamId,
          )?.pointsScored || 0;
        const [winningTeamId, losingTeamId] =
          decideCupGame({
            topScore: topTeamScore,
            bottomScore: bottomTeamScore,
            topSeed: cupGame.topTeam!.seed,
            bottomSeed: cupGame.bottomTeam?.seed ?? null,
          }) === 'top'
            ? [cupGame.topTeamId, cupGame.bottomTeamId]
            : [cupGame.bottomTeamId, cupGame.topTeamId];
        promises.push(
          recordCupGameResult(cupGame, winningTeamId, losingTeamId),
        );
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
            {cupWeeks.map(cupWeek => {
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
      <h3>Import from Challonge</h3>
      <p>
        For cups played on Challonge before the site ran them. Map the weeks
        above first. Importing replaces this cup's seeds and games with
        Challonge's.
      </p>
      <Form method='POST' className='flex flex-wrap items-center gap-2'>
        <label htmlFor='slug'>challonge.com/</label>
        <input
          type='text'
          name='slug'
          id='slug'
          defaultValue={`${cup.year}FSCup`}
          className='form-input dark:border-0 dark:bg-slate-800'
        />
        <Button type='submit' name='_action' value='challongePreview'>
          Preview Import
        </Button>
        <Button type='submit' name='_action' value='challongeImport'>
          Import
        </Button>
      </Form>
      {actionData?.report && <ChallongeReport report={actionData.report} />}
    </>
  );
}

function ChallongeReport({ report }: { report: ChallongeMatchReport }) {
  return (
    <>
      {report.errors.length > 0 && (
        <>
          <h4>Errors</h4>
          <ul>
            {report.errors.map(error => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </>
      )}
      {report.winnerDisagreements.length > 0 && (
        <>
          <h4>Results the site's scores would have decided differently</h4>
          <p>Challonge's result is kept.</p>
          <ul>
            {report.winnerDisagreements.map(disagreement => (
              <li key={`${disagreement.round}-${disagreement.challongeWinner}`}>
                Round {disagreement.round}: {disagreement.challongeWinner} beat{' '}
                {disagreement.challongeLoser}{' '}
                {disagreement.challongeScores.join('-')} on Challonge; the site
                has{' '}
                {disagreement.siteScores
                  .map(score => score.toFixed(2))
                  .join('-')}
              </li>
            ))}
          </ul>
        </>
      )}
      <h4>
        Participants ({report.assignments.length} matched,{' '}
        {report.seedDifferences.length} seeded differently,{' '}
        {report.scoreDeltas.length} scores differ)
      </h4>
      <table>
        <thead>
          <tr>
            <th>Seed</th>
            <th>Challonge</th>
            <th>Team</th>
            <th>League</th>
            <th>Seed on site points</th>
            <th>Score differences</th>
          </tr>
        </thead>
        <tbody>
          {report.assignments.map(({ participant, team, seedRank }) => (
            <tr key={participant.id}>
              <td>{participant.seed}</td>
              <td>{participant.name}</td>
              <td>{team.name}</td>
              <td>{team.league}</td>
              <td>{seedRank === participant.seed ? '' : seedRank}</td>
              <td>
                {report.scoreDeltas
                  .filter(delta => delta.participantName === participant.name)
                  .map(
                    delta =>
                      `R${delta.round}: ${
                        delta.challongeScore
                      } vs ${delta.sitePoints.toFixed(2)}`,
                  )
                  .join(', ')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
