import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form, useNavigation } from '@remix-run/react';
import {
  typedjson,
  useTypedActionData,
  useTypedLoaderData,
} from 'remix-typedjson';
import Alert from '~/components/ui/Alert';
import Button from '~/components/ui/Button';
import {
  createSeason,
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
      const season = await createSeason({
        year: new Date().getFullYear(),
        isCurrent: false,
        isOpenForRegistration: false,
        isOpenForFSquared: false,
        registrationSize: 60,
      });

      return typedjson({
        message: `${season.year} season has been created`,
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
  }

  return typedjson({ message: 'Nothing has happened.' });
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  const seasons = await getSeasons();

  return typedjson({ seasons });
};

export default function SeasonIndex() {
  const { seasons } = useTypedLoaderData<typeof loader>();
  const actionData = useTypedActionData<typeof action>();
  const navigation = useNavigation();

  return (
    <>
      <h2 className='mt-0'>Season List</h2>
      {actionData?.message && <Alert message={actionData.message} />}
      <table className='w-full'>
        <thead>
          <tr>
            <th>Year</th>
            <th>Active?</th>
            <th>Open Registration?</th>
            <th>Open F²?</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {seasons.map(season => {
            const {
              id,
              year,
              isCurrent,
              isOpenForRegistration,
              isOpenForFSquared,
            } = season;

            return (
              <tr key={id}>
                <td>{year}</td>
                <td>{isCurrent ? 'Yes' : 'No'}</td>
                <td>{isOpenForRegistration ? 'Yes' : 'No'}</td>
                <td>{isOpenForFSquared ? 'Yes' : 'No'}</td>
                <td className='not-prose'>
                  {!isCurrent && (
                    <Form method='POST'>
                      <input type='hidden' name='seasonId' value={id} />
                      <Button type='submit' name='_action' value='setActive'>
                        Set Active
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
                        >
                          {isOpenForFSquared ? 'Close F²' : 'Open F²'}
                        </Button>
                      </Form>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Form method='POST'>
        <div>
          <Button
            type='submit'
            name='_action'
            value='createSeason'
            disabled={navigation.state !== 'idle'}
          >
            Create Season for Current Year
          </Button>
        </div>
      </Form>
    </>
  );
}
