import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form, useNavigation } from '@remix-run/react';
import {
  typedjson,
  useTypedActionData,
  useTypedLoaderData,
} from 'remix-typedjson';
import Alert from '~/components/ui/Alert';
import { Button } from '~/components/ui/button';
import { Link } from '~/components/ui/link';
import { Section } from '~/components/ui/section';
import { Table } from '~/components/ui/table';
import {
  getLeagueCountForYear,
  getLeagueCountsByYear,
} from '~/models/league.server';
import {
  createSeason,
  deleteSeason,
  getSeason,
  getSeasonById,
  getSeasons,
  updateActiveSeason,
  updateSeason,
} from '~/models/season.server';
import { authenticator, requireAdmin } from '~/services/auth.server';

export const action = async ({ request }: ActionFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  const formData = await request.formData();
  const action = formData.get('_action');

  if (typeof action !== 'string') {
    throw new Error(`Form not generated correctly.`);
  }

  switch (action) {
    case 'createSeason': {
      const year = new Date().getFullYear();

      const existingSeason = await getSeason(year);
      if (existingSeason) {
        return typedjson({
          message: `A ${year} season already exists.`,
        });
      }

      const season = await createSeason({
        year,
        isCurrent: false,
        isOpenForRegistration: false,
        isOpenForFSquared: false,
        isOpenForDFSSurvivor: false,
        registrationSize: 60,
      });

      return typedjson({
        message: `${season.year} season has been created`,
      });
    }
    case 'deleteSeason': {
      const seasonId = formData.get('seasonId');
      if (typeof seasonId !== 'string') {
        throw new Error(`Form not generated correctly.`);
      }

      const season = await getSeasonById(seasonId);
      if (!season) {
        return typedjson({ message: 'Season not found.' });
      }

      if (season.isCurrent) {
        return typedjson({
          message: `Cannot delete the active season.`,
        });
      }

      const leagueCount = await getLeagueCountForYear(season.year);
      if (leagueCount > 0) {
        return typedjson({
          message: `Cannot delete a season that has leagues attached.`,
        });
      }

      await deleteSeason(seasonId);

      return typedjson({
        message: `${season.year} season has been deleted`,
      });
    }
    case 'setActive': {
      const seasonId = formData.get('seasonId');
      if (typeof seasonId !== 'string') {
        throw new Error(`Form not generated correctly.`);
      }
      const [, season] = await updateActiveSeason(seasonId);

      return typedjson({
        message: `${season.year} season has been made active`,
      });
    }
    case 'setRegistration': {
      const seasonId = formData.get('seasonId');
      const actionToSeason = formData.get('actionToSeason');
      if (typeof seasonId !== 'string' || typeof actionToSeason !== 'string') {
        throw new Error(`Form not generated correctly.`);
      }

      const season = await updateSeason({
        id: seasonId,
        isOpenForRegistration: actionToSeason === 'openReg',
      });

      return typedjson({
        message: `${season.year} season registration is now ${
          season.isOpenForRegistration ? 'open' : 'closed'
        }.`,
      });
    }
    case 'setFSquared': {
      const seasonId = formData.get('seasonId');
      const actionToSeason = formData.get('actionToSeason');
      if (typeof seasonId !== 'string' || typeof actionToSeason !== 'string') {
        throw new Error(`Form not generated correctly.`);
      }

      const season = await updateSeason({
        id: seasonId,
        isOpenForFSquared: actionToSeason === 'openFSquared',
      });

      return typedjson({
        message: `${season.year} F² is now ${
          season.isOpenForFSquared ? 'open' : 'closed'
        }.`,
      });
    }
    case 'setDFSSurvivor': {
      const seasonId = formData.get('seasonId');
      const actionToSeason = formData.get('actionToSeason');
      if (typeof seasonId !== 'string' || typeof actionToSeason !== 'string') {
        throw new Error(`Form not generated correctly.`);
      }

      const season = await updateSeason({
        id: seasonId,
        isOpenForDFSSurvivor: actionToSeason === 'openDFSSurvivor',
      });

      return typedjson({
        message: `${season.year} DFS Survivor is now ${
          season.isOpenForDFSSurvivor ? 'open' : 'closed'
        }.`,
      });
    }
  }

  return typedjson({ message: 'Nothing has happened.' });
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  const seasons = await getSeasons();

  const leagueCounts = await getLeagueCountsByYear();
  const leagueCountsByYear: Record<number, number> = {};
  for (const { year, _count } of leagueCounts) {
    leagueCountsByYear[year] = _count._all;
  }

  return typedjson({ seasons, leagueCountsByYear });
};

export default function SeasonIndex() {
  const { seasons, leagueCountsByYear } = useTypedLoaderData<typeof loader>();
  const actionData = useTypedActionData<typeof action>();
  const navigation = useNavigation();

  return (
    <Section
      title='Seasons'
      action={
        <Form method='POST'>
          <Button
            type='submit'
            name='_action'
            value='createSeason'
            disabled={navigation.state !== 'idle'}
          >
            Create Season for Current Year
          </Button>
        </Form>
      }
    >
      {actionData?.message && (
        <Alert message={actionData.message} className='mb-6' />
      )}
      <Table
        headers={[
          'Year',
          'Leagues',
          'Active',
          'Registration Open',
          'F² Open',
          'DFS Survivor Open',
          'Actions',
        ]}
        numericColumns={[1]}
        primaryColumns={[2, 6]}
      >
        {seasons.map(season => {
          const {
            id,
            year,
            isCurrent,
            isOpenForRegistration,
            isOpenForFSquared,
            isOpenForDFSSurvivor,
          } = season;

          const leagueCount = leagueCountsByYear[year] ?? 0;

          return (
            <tr key={id}>
              <td>{year}</td>
              <td className='text-right'>{leagueCount}</td>
              <td>{isCurrent ? 'Yes' : 'No'}</td>
              <td>{isOpenForRegistration ? 'Yes' : 'No'}</td>
              <td>{isOpenForFSquared ? 'Yes' : 'No'}</td>
              <td>{isOpenForDFSSurvivor ? 'Yes' : 'No'}</td>
              <td>
                <div className='flex flex-wrap gap-2'>
                  {!isCurrent && (
                    <Form method='POST'>
                      <input type='hidden' name='seasonId' value={id} />
                      <Button
                        type='submit'
                        name='_action'
                        value='setActive'
                        variant='secondary'
                        size='sm'
                      >
                        Set Active
                      </Button>
                    </Form>
                  )}
                  {!isCurrent && leagueCount === 0 && (
                    <Form method='POST'>
                      <input type='hidden' name='seasonId' value={id} />
                      <Button
                        type='submit'
                        name='_action'
                        value='deleteSeason'
                        variant='secondary'
                        size='sm'
                        onClick={e => {
                          if (!confirm('Delete this season?')) {
                            e.preventDefault();
                          }
                        }}
                      >
                        Delete
                      </Button>
                    </Form>
                  )}
                  {isCurrent && (
                    <>
                      <Form method='POST'>
                        <input type='hidden' name='seasonId' value={id} />
                        <input
                          type='hidden'
                          name='actionToSeason'
                          value={
                            !isOpenForRegistration ? 'openReg' : 'closeReg'
                          }
                        />
                        <Button
                          type='submit'
                          name='_action'
                          value='setRegistration'
                          variant='secondary'
                          size='sm'
                        >
                          {isOpenForRegistration
                            ? 'Close Registration'
                            : 'Open Registration'}
                        </Button>
                      </Form>
                      <Form method='POST'>
                        <input type='hidden' name='seasonId' value={id} />
                        <input
                          type='hidden'
                          name='actionToSeason'
                          value={
                            !isOpenForFSquared
                              ? 'openFSquared'
                              : 'closeFSquared'
                          }
                        />
                        <Button
                          type='submit'
                          name='_action'
                          value='setFSquared'
                          variant='secondary'
                          size='sm'
                        >
                          {isOpenForFSquared ? 'Close F²' : 'Open F²'}
                        </Button>
                      </Form>
                      <Form method='POST'>
                        <input type='hidden' name='seasonId' value={id} />
                        <input
                          type='hidden'
                          name='actionToSeason'
                          value={
                            !isOpenForDFSSurvivor
                              ? 'openDFSSurvivor'
                              : 'closeDFSSurvivor'
                          }
                        />
                        <Button
                          type='submit'
                          name='_action'
                          value='setDFSSurvivor'
                          variant='secondary'
                          size='sm'
                        >
                          {isOpenForDFSSurvivor
                            ? 'Close DFS Survivor'
                            : 'Open DFS Survivor'}
                        </Button>
                      </Form>
                      <Button asChild>
                        <Link
                          to={`/admin/season/${id}/sorting`}
                          variant='quiet'
                        >
                          League Sorting
                        </Link>
                      </Button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </Table>
    </Section>
  );
}
