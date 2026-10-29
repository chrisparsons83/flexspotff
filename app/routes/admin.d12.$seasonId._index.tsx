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
import { Input } from '~/components/ui/input';
import { Section } from '~/components/ui/section';
import { Table } from '~/components/ui/table';
import {
  syncD12LeagueWeek,
  syncD12Season,
  syncD12DraftPicksForSeason,
  inferD12LeagueUsers,
  getD12LeagueLineup,
  LAST_D12_WEEK,
  getSleeperLeagueInfo,
  parseSleeperLeagueIdFromUrl,
  resolveLeagueOwners,
} from '~/libs/d12-sync.server';
import { getNflState } from '~/libs/syncs.server';
import {
  createD12League,
  deleteD12League,
  getD12LeagueById,
  getD12LeaguesBySeasonId,
} from '~/models/d12league.server';
import { getD12SeasonById } from '~/models/d12season.server';
import { authenticator, requireAdmin } from '~/services/auth.server';

export const action = async ({ params, request }: ActionFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  const seasonId = params.seasonId;
  if (!seasonId) throw new Error('Missing season ID');

  const formData = await request.formData();
  const _action = formData.get('_action');

  switch (_action) {
    case 'addLeague': {
      const sleeperUrl = formData.get('sleeperUrl');
      if (typeof sleeperUrl !== 'string')
        throw new Error('Missing required fields');

      const sleeperLeagueId = parseSleeperLeagueIdFromUrl(sleeperUrl);
      const { name } = await getSleeperLeagueInfo(sleeperLeagueId);
      const inferredUsers = await inferD12LeagueUsers(sleeperLeagueId);

      await createD12League({ name, sleeperLeagueId, d12SeasonId: seasonId });
      return typedjson({
        message: `League "${name}" added${
          inferredUsers.length > 0
            ? ` (${inferredUsers.length} managers mapped)`
            : ' (warning: no managers mapped to Discord users yet)'
        }`,
        errors: undefined as string[] | undefined,
      });
    }

    case 'deleteLeague': {
      const leagueId = formData.get('leagueId');
      if (typeof leagueId !== 'string')
        throw new Error('League ID is required');
      await deleteD12League(leagueId);
      return typedjson({
        message: 'League deleted',
        errors: undefined as string[] | undefined,
      });
    }

    case 'syncAllScores': {
      const season = await getD12SeasonById(seasonId);
      if (!season) throw new Error('Season not found');
      const errors = await syncD12Season(season.year);
      return typedjson({
        message: `All scores synced for ${season.year}`,
        errors: errors.length > 0 ? errors : undefined,
      });
    }

    case 'syncDraftPicks': {
      const season = await getD12SeasonById(seasonId);
      if (!season) throw new Error('Season not found');
      const errors = await syncD12DraftPicksForSeason(season.year);
      return typedjson({
        message: `Draft picks synced for ${season.year}`,
        errors: errors.length > 0 ? errors : undefined,
      });
    }

    case 'syncLeague': {
      const leagueId = formData.get('leagueId');
      if (typeof leagueId !== 'string')
        throw new Error('League ID is required');
      const league = await getD12LeagueById(leagueId);
      if (!league) throw new Error('League not found');

      const maxWeek = Math.min((await getNflState()).week, LAST_D12_WEEK);
      // Both are per-league rather than per-week, so they stay out of the loop.
      const [{ rosterToOwner, ownerToUserId }, lineup] = await Promise.all([
        resolveLeagueOwners(league.sleeperLeagueId),
        getD12LeagueLineup(league.sleeperLeagueId),
      ]);

      const errors: string[] = [];
      for (let week = 1; week <= maxWeek; week++) {
        try {
          errors.push(
            ...(await syncD12LeagueWeek(
              league,
              week,
              rosterToOwner,
              ownerToUserId,
              lineup,
            )),
          );
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          errors.push(`Week ${week}: ${msg}`);
        }
      }
      return typedjson({
        message: `Scores resynced for "${league.name}" (weeks 1–${maxWeek})`,
        errors: errors.length > 0 ? errors : undefined,
      });
    }

    case 'syncCurrentWeek': {
      const weekStr = formData.get('week');
      if (typeof weekStr !== 'string' || weekStr.trim() === '')
        return typedjson({
          message: 'Week is required',
          errors: undefined as string[] | undefined,
        });
      const week = Number(weekStr);
      if (isNaN(week) || week <= 0)
        return typedjson({
          message: 'Week must be greater than 0',
          errors: undefined as string[] | undefined,
        });
      // Past week 17 a row would be summed into season totals by the unfiltered
      // read query and then never refreshed, since syncD12Season only backfills
      // that far. syncD12Week caps itself the same way.
      if (week > LAST_D12_WEEK)
        return typedjson({
          message: `Week must be ${LAST_D12_WEEK} or less - D12 mirrors the NFL regular season`,
          errors: undefined as string[] | undefined,
        });

      const season = await getD12SeasonById(seasonId);
      if (!season) throw new Error('Season not found');

      const leagues = await getD12LeaguesBySeasonId(seasonId);
      const errors: string[] = [];
      await Promise.all(
        leagues.map(async league => {
          try {
            const [{ rosterToOwner, ownerToUserId }, lineup] =
              await Promise.all([
                resolveLeagueOwners(league.sleeperLeagueId),
                getD12LeagueLineup(league.sleeperLeagueId),
              ]);
            errors.push(
              ...(await syncD12LeagueWeek(
                league,
                week,
                rosterToOwner,
                ownerToUserId,
                lineup,
              )),
            );
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            errors.push(`"${league.name}": ${msg}`);
          }
        }),
      );
      return typedjson({
        message: `Week ${week} scores synced`,
        errors: errors.length > 0 ? errors : undefined,
      });
    }
  }

  return typedjson({
    message: 'No action taken',
    errors: undefined as string[] | undefined,
  });
};

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  const seasonId = params.seasonId;
  if (!seasonId) throw new Error('Missing season ID');

  const season = await getD12SeasonById(seasonId);
  if (!season) throw new Error('Season not found');

  return typedjson({ season });
};

export default function AdminD12SeasonIndex() {
  const { season } = useTypedLoaderData<typeof loader>();
  const actionData = useTypedActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state !== 'idle';

  return (
    <Section title={`Administer ${season.year} D12 Season`}>
      {actionData?.message && (
        <Alert message={actionData.message} className='mb-6' />
      )}
      {actionData?.errors?.map(err => (
        <Alert key={err} message={err} status='error' className='mb-6' />
      ))}

      <div className='flex flex-col items-start gap-6'>
        <Form method='POST'>
          <Button
            type='submit'
            name='_action'
            value='syncAllScores'
            disabled={isSubmitting}
          >
            Sync All Scores
          </Button>
        </Form>
        <Form method='POST' className='flex items-end gap-3'>
          <Button
            type='submit'
            name='_action'
            value='syncCurrentWeek'
            disabled={isSubmitting}
          >
            Sync This Week
          </Button>
          <Field label='Week' className='w-20'>
            <Input name='week' type='number' min='1' max='17' />
          </Field>
        </Form>
      </div>

      <Section as='h3' title='Leagues'>
        {season.leagues.length === 0 ? (
          <p className='text-muted-foreground'>No leagues added yet.</p>
        ) : (
          <Table headers={['Name', 'Sleeper League ID', '']}>
            {season.leagues.map(league => (
              <tr key={league.id}>
                <td>{league.name}</td>
                <td className='font-mono text-sm'>{league.sleeperLeagueId}</td>
                <td>
                  <div className='flex gap-2'>
                    <Form method='POST'>
                      <input type='hidden' name='leagueId' value={league.id} />
                      <Button
                        type='submit'
                        name='_action'
                        value='syncLeague'
                        disabled={isSubmitting}
                      >
                        Sync
                      </Button>
                    </Form>
                    <Form
                      method='POST'
                      onSubmit={e => {
                        if (
                          !window.confirm(
                            `Delete "${league.name}"? This cannot be undone.`,
                          )
                        ) {
                          e.preventDefault();
                        }
                      }}
                    >
                      <input type='hidden' name='leagueId' value={league.id} />
                      <Button
                        type='submit'
                        name='_action'
                        value='deleteLeague'
                        disabled={isSubmitting}
                      >
                        Delete
                      </Button>
                    </Form>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Section>

      <Section as='h3' title='Add League'>
        <Form
          key={actionData?.message}
          method='POST'
          className='flex flex-wrap items-end gap-3'
        >
          <Field label='Sleeper League URL' className='w-full sm:w-96'>
            <Input
              name='sleeperUrl'
              placeholder='https://sleeper.com/leagues/123456789'
            />
          </Field>
          <Button
            type='submit'
            name='_action'
            value='addLeague'
            disabled={isSubmitting}
          >
            Add League
          </Button>
        </Form>
      </Section>

      <Section as='h3' title='Draft Picks'>
        <Form method='POST'>
          <Button
            type='submit'
            name='_action'
            value='syncDraftPicks'
            disabled={isSubmitting}
          >
            Sync Draft Picks
          </Button>
        </Form>
      </Section>
    </Section>
  );
}
