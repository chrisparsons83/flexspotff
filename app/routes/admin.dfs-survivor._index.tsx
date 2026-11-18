import type {
  DFSSurvivorUserWeek,
  Season,
  DFSSurvivorUserEntry,
  Player,
} from '@prisma/client';
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form } from '@remix-run/react';
import {
  typedjson,
  useTypedActionData,
  useTypedLoaderData,
} from 'remix-typedjson';
import Alert from '~/components/ui/Alert';
import { Button } from '~/components/ui/button';
import { Section } from '~/components/ui/section';
import { Table } from '~/components/ui/table';
import { prisma } from '~/db.server';
import { syncPlayerWeekScores } from '~/libs/dfs-survivor/player-week-scores.server';
import { DFS_SURVIVOR_LAST_WEEK } from '~/libs/dfs-survivor/slots';
import {
  revertDfsSurvivorWeek,
  scoreDfsSurvivorWeek,
} from '~/libs/side-games/dfs-survivor.server';
import { getDfsSurvivorWeekByYearAndWeek } from '~/models/dfssurvivorweek.server';
import { getCurrentNflWeek } from '~/models/nflgame.server';
import { getCurrentSeason } from '~/models/season.server';
import { authenticator, requireAdmin } from '~/services/auth.server';

type WeekWithEntries = DFSSurvivorUserWeek & {
  entries: (DFSSurvivorUserEntry & {
    player: Player;
  })[];
};

type LoaderData = {
  dfsSurvivorWeeks: WeekWithEntries[];
  currentSeason: Season;
};

// If the below fields do not exist, it is safe to assume they are 0.
export const action = async ({ request }: ActionFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  const formData = await request.formData();
  const _action = formData.get('_action');

  if (_action === 'createNewWeek') {
    const currentSeason = await getCurrentSeason();
    if (!currentSeason) {
      throw new Error('No active season currently');
    }
  } else if (_action === 'scoreWeek') {
    const weekNumberString = formData.get('weekNumber');
    const yearString = formData.get('year');
    const id = formData.get('id');

    if (
      typeof weekNumberString !== 'string' ||
      typeof yearString !== 'string' ||
      typeof id !== 'string'
    ) {
      throw new Error('Form has not been formed correctly');
    }

    const year = Number(yearString);
    const weekNumber = Number(weekNumberString);

    // The same shared functions the Monday-night automation runs. The admin
    // button keeps its revert escape hatch: a scored week flips back to unscored.
    const dfsWeek = await getDfsSurvivorWeekByYearAndWeek(year, weekNumber);
    if (!dfsWeek) {
      throw new Error('No DFS survivor week records found for this week');
    }

    const { message } = dfsWeek.isScored
      ? await revertDfsSurvivorWeek(year, weekNumber)
      : await scoreDfsSurvivorWeek(year, weekNumber);

    return typedjson({ message });
  } else if (_action === 'syncPlayerScores') {
    const currentSeason = await getCurrentSeason();
    if (!currentSeason) {
      throw new Error('No active season currently');
    }

    const currentWeek = await getCurrentNflWeek(currentSeason.year, new Date());
    if (!currentWeek) {
      return typedjson({
        message: `No NFL schedule stored for ${currentSeason.year}.`,
      });
    }

    const through = Math.min(currentWeek + 1, DFS_SURVIVOR_LAST_WEEK);
    for (let week = 1; week <= through; week++) {
      await syncPlayerWeekScores(currentSeason.year, week);
    }

    return typedjson({
      message: `Player scores and projections synced through week ${through}.`,
    });
  }

  return typedjson({ message: 'Invalid action' });
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  const currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    throw new Error('No active season currently');
  }

  try {
    // Get unique weeks by grouping and taking the first record for each week
    const dfsSurvivorWeeks = await prisma.dFSSurvivorUserWeek.findMany({
      where: {
        year: currentSeason.year,
      },
      include: {
        entries: {
          include: {
            player: true,
          },
        },
      },
      orderBy: {
        week: 'desc',
      },
    });

    // Filter to get only one record per week (take the first one since they should all have the same isScored status now)
    const uniqueWeeks = dfsSurvivorWeeks.reduce((acc, week) => {
      if (!acc.find(w => w.week === week.week)) {
        // For each unique week, get ALL entries from ALL users for that week
        const allEntriesForWeek = dfsSurvivorWeeks
          .filter(w => w.week === week.week)
          .flatMap(w => w.entries);

        acc.push({
          ...week,
          entries: allEntriesForWeek,
        });
      }
      return acc;
    }, [] as typeof dfsSurvivorWeeks);

    return typedjson<LoaderData>({
      dfsSurvivorWeeks: uniqueWeeks,
      currentSeason,
    });
  } catch (error) {
    console.error('Error fetching DFS Survivor weeks:', error);
    throw new Error('Failed to fetch DFS Survivor weeks');
  }
};

export default function AdminDfsSurvivorIndex() {
  const { dfsSurvivorWeeks } = useTypedLoaderData<typeof loader>();
  const actionData = useTypedActionData<typeof action>();

  return (
    <Section title='DFS Survivor'>
      {actionData?.message && (
        <Alert message={actionData.message} className='mb-6' />
      )}
      <Form method='POST' className='mb-6'>
        <Button type='submit' name='_action' value='syncPlayerScores'>
          Sync Player Scores and Projections
        </Button>
        <p className='mt-2 max-w-prose text-sm text-muted-foreground'>
          Refreshes every player's weekly points and projections from Sleeper.
          Runs hourly on its own; this is for backfilling.
        </p>
      </Form>
      <Table headers={['Week', 'Scored', 'Actions']}>
        {dfsSurvivorWeeks.map((week: WeekWithEntries) => (
          <tr key={week.id}>
            <td>{week.week}</td>
            <td>{week.isScored ? 'Yes' : 'No'}</td>
            <td>
              <Form method='POST'>
                <input type='hidden' name='weekNumber' value={week.week} />
                <input type='hidden' name='year' value={week.year} />
                <input type='hidden' name='id' value={week.id} />
                <Button type='submit' name='_action' value='scoreWeek'>
                  {week.isScored ? 'Revert Scoring' : 'Score Week'}
                </Button>
              </Form>
            </td>
          </tr>
        ))}
      </Table>
    </Section>
  );
}
