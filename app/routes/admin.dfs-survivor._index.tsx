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
import Button from '~/components/ui/FlexSpotButton';
import { prisma } from '~/db.server';
import { syncPlayerWeekScores } from '~/libs/dfs-survivor/player-week-scores.server';
import { scoreDfsSurvivorPlayer } from '~/libs/dfs-survivor/scoring';
import { DFS_SURVIVOR_LAST_WEEK } from '~/libs/dfs-survivor/slots';
import { getWeeklyStats } from '~/libs/sleeper/api.server';
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

    // Get ALL week records for this NFL week (all users)
    const allWeekRecords = await prisma.dFSSurvivorUserWeek.findMany({
      where: {
        year,
        week: weekNumber,
      },
      include: {
        entries: {
          include: {
            player: true,
          },
        },
      },
    });

    if (allWeekRecords.length === 0) {
      throw new Error('No DFS Survivor Week records found for this week');
    }

    // Check if the week is already scored
    const isCurrentlyScored = allWeekRecords[0]?.isScored || false;

    if (isCurrentlyScored) {
      // UNSCORE: Reset all entry points to 0 and mark week as unscored
      const promises: Promise<any>[] = [];

      for (const weekRecord of allWeekRecords) {
        for (const entry of weekRecord.entries) {
          promises.push(
            prisma.dFSSurvivorUserEntry.update({
              where: {
                id: entry.id,
              },
              data: {
                points: 0,
              },
            }),
          );
        }
      }

      await Promise.all(promises);

      // Mark ALL week records for this NFL week as unscored
      await prisma.dFSSurvivorUserWeek.updateMany({
        where: {
          year,
          week: weekNumber,
        },
        data: {
          isScored: false,
        },
      });

      return typedjson({ message: 'Week scoring has been reverted.' });
    } else {
      // SCORE: Calculate points and mark week as scored
      // Fetch stats from Sleeper API
      const sleeperJson = await getWeeklyStats(year, weekNumber);

      const promises: Promise<any>[] = [];

      // Score ALL entries from ALL users for this week
      for (const weekRecord of allWeekRecords) {
        for (const entry of weekRecord.entries) {
          const stats = sleeperJson[entry.player.sleeperId] || {};
          const score = scoreDfsSurvivorPlayer(entry.player.position, stats);

          promises.push(
            prisma.dFSSurvivorUserEntry.update({
              where: {
                id: entry.id,
              },
              data: {
                points: score,
              },
            }),
          );
        }
      }

      await Promise.all(promises);

      // Mark ALL week records for this NFL week as scored
      await prisma.dFSSurvivorUserWeek.updateMany({
        where: {
          year,
          week: weekNumber,
        },
        data: {
          isScored: true,
        },
      });

      // Keep PlayerWeekScore in step, so the entry picker's season-to-date
      // column agrees with what entries were just scored on. Scoring is already
      // committed at this point, so a Sleeper outage here must not surface as a
      // failed scoring run - it would invite a pointless re-score.
      try {
        await syncPlayerWeekScores(year, weekNumber);
      } catch (error) {
        console.error('Player score sync after scoring failed:', error);
        return typedjson({
          message:
            'Week has been scored, but refreshing player scores failed. Use Sync Player Scores to retry.',
        });
      }

      return typedjson({ message: 'Week has been scored.' });
    }
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
    <>
      <h2>DFS Survivor</h2>
      {actionData?.message && <Alert message={actionData.message} />}
      <Form method='POST' className='mb-4'>
        <Button type='submit' name='_action' value='syncPlayerScores'>
          Sync Player Scores &amp; Projections
        </Button>
        <p className='mt-1 text-sm'>
          Refreshes every player's weekly points and projections from Sleeper.
          Runs hourly on its own; this is for backfilling.
        </p>
      </Form>
      <table className='w-full'>
        <thead>
          <tr>
            <th>Week</th>
            <th>Scored</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
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
        </tbody>
      </table>
    </>
  );
}
