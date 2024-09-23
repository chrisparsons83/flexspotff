import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form, useNavigation } from '@remix-run/react';
import { useState } from 'react';
import {
  typedjson,
  useTypedActionData,
  useTypedLoaderData,
} from 'remix-typedjson';
import z from 'zod';
import FSquaredEntryFormSection from '~/components/layout/f-squared/FSquaredEntryFormSection';
import Alert from '~/components/ui/Alert';
import Button from '~/components/ui/Button';
import {
  createEntry,
  getEntryByUserAndYear,
  updateEntry,
} from '~/models/fsquared.server';
import type { League } from '~/models/league.server';
import { getLeaguesByYear } from '~/models/league.server';
import { getCurrentSeason } from '~/models/season.server';
import { getTeamsInSeason } from '~/models/team.server';
import { authenticator } from '~/services/auth.server';
import { shuffleArray } from '~/utils/helpers';

const formEntry = z.string().array().length(2);
type FormEntry = z.infer<typeof formEntry>;

function convertExistingEntryToInitialFormState(
  existingEntry: Awaited<ReturnType<typeof getEntryByUserAndYear>> | null,
  leagues: Record<string, Awaited<ReturnType<typeof getTeamsInSeason>>>,
) {
  const result: Record<string, boolean> = {};
  const now = new Date();

  if (existingEntry) {
    for (const team of existingEntry.teams) {
      result[team.league.name] = true;
    }
  }

  for (const leagueName in leagues) {
    const league = leagues[leagueName][0].league;
    if (league.draftDateTime && league.draftDateTime < now) {
      result[leagueName] = true;
    }
  }

  return result;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });

  let currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    throw new Error('No active season currently');
  }

  const leagues = await getLeaguesByYear(currentSeason.year);
  const formData = await request.formData();

  const fSquaredForm: Record<string, FormEntry> = {};
  leagues
    .filter(
      league => !league.draftDateTime || league.draftDateTime >= new Date(),
    )
    .forEach(league => {
      const entry = formEntry.parse(formData.getAll(league.name));
      fSquaredForm[league.name] = entry;
    });

  let existingEntry = await getEntryByUserAndYear(user.id, currentSeason.year);
  const newEntries: string[] = [];
  for (const league of leagues) {
    if (league.draftDateTime && league.draftDateTime < new Date()) {
      // League has drafted and there's no entry, so you need to pick two at random.
      if (!existingEntry) {
        const twoRandomTeams = shuffleArray(
          league.teams.map(team => team.id),
        ).slice(0, 2);
        newEntries.push(...twoRandomTeams);
      } else {
        const entryTeamsFromLeague = existingEntry.teams
          .filter(team => team.league.name === league.name)
          .map(team => team.id);
        newEntries.push(...entryTeamsFromLeague);
      }
    } else {
      newEntries.push(...fSquaredForm[league.name]);
    }
  }

  if (!existingEntry) {
    const newEntry = await createEntry({
      userId: user.id,
      year: currentSeason.year,
    });
    await updateEntry(newEntry.id, newEntries, []);
  } else {
    const originalEntries = existingEntry.teams.map(team => team.id);
    const addingEntries = newEntries.filter(
      team => !originalEntries.includes(team),
    );
    const removingEntries = originalEntries.filter(
      team => !newEntries.includes(team),
    );
    await updateEntry(existingEntry.id, addingEntries, removingEntries);
  }

  return typedjson({
    message: `Your entry has been ${existingEntry ? 'updated' : 'created'}.`,
  });
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });

  let currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    throw new Error('No active season currently');
  }

  // Get teams
  const teams = await getTeamsInSeason(currentSeason.year);

  // Get existing entry
  const existingEntry = await getEntryByUserAndYear(
    user.id,
    currentSeason.year,
  );

  // Make record object for simplicity
  const leagues: Record<
    string,
    Awaited<ReturnType<typeof getTeamsInSeason>>
  > = {};
  for (const team of teams) {
    if (leagues[team.league.name]) {
      leagues[team.league.name].push(team);
    } else {
      leagues[team.league.name] = [team];
    }
  }

  return typedjson({ leagues, existingEntry });
};

export default function FSquaredMyEntry() {
  const actionData = useTypedActionData<typeof action>();
  const { leagues, existingEntry } = useTypedLoaderData<typeof loader>();
  const navigation = useNavigation();

  const [validLeagueCheck, setValidLeagueCheck] = useState<
    Record<string, boolean>
  >(convertExistingEntryToInitialFormState(existingEntry, leagues));

  const numberOfLeagues = Object.keys(leagues).length;

  const handleValidFormChange = (
    leagueName: League['id'],
    isValid: boolean,
  ) => {
    setValidLeagueCheck(prevState => {
      const state = { ...prevState };
      state[leagueName] = isValid;
      return state;
    });
  };

  const isValidForm =
    Object.keys(validLeagueCheck).length === numberOfLeagues &&
    Object.values(validLeagueCheck).every(Boolean);

  const buttonText =
    navigation.state === 'submitting'
      ? 'Submitting...'
      : navigation.state === 'loading'
      ? 'Submitted!'
      : 'Submit';

  return (
    <div>
      <h2>My F² Entry</h2>
      <p>
        Pick two teams from each league. Teams are listed by their draft order.
      </p>
      <p>You can change your picks for a league until their draft begins.</p>
      <p>
        If you have not submitted an entry yet and a league has already drafted,
        you can pick the rest of the leagues, and you will be assigned teams at
        random from leagues that have drafted.
      </p>
      {actionData?.message && <Alert message={actionData.message} />}
      <Form method='POST' reloadDocument>
        <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
          {Object.entries(leagues).map(([leagueName, teams]) => (
            <FSquaredEntryFormSection
              key={leagueName}
              leagueName={leagueName}
              teams={teams}
              isLeagueValid={handleValidFormChange}
              existingPicks={
                existingEntry &&
                existingEntry.teams
                  .filter(team => team.league.name === leagueName)
                  .map(team => team.id)
              }
            />
          ))}
        </div>
        <div className='block p-4'>
          <Button
            type='submit'
            disabled={!isValidForm || navigation.state !== 'idle'}
          >
            {buttonText}
          </Button>
        </div>
      </Form>
    </div>
  );
}
