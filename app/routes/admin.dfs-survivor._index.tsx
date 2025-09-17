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
import z from 'zod';
import Alert from '~/components/ui/Alert';
import Button from '~/components/ui/FlexSpotButton';
import { prisma } from '~/db.server';
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
const sleeperJsonStats = z.record(
  z.object({
    pts_ppr: z.number().optional(),
    pass_yd: z.number().optional(),
    pass_td: z.number().optional(),
    rush_yd: z.number().optional(),
    rush_td: z.number().optional(),
    rec_yd: z.number().optional(),
    rec_td: z.number().optional(),
    rec: z.number().optional(),
    pass_int: z.number().optional(),
    fum_lost: z.number().optional(),
    rush_2pt: z.number().optional(),
    rec_2pt: z.number().optional(),
    pass_2pt: z.number().optional(),
    off_fum_rec_td: z.number().optional(),
    punt_ret_td: z.number().optional(),
    kick_ret_td: z.number().optional(),
    pts_allow: z.number().optional(),
    yds_allow: z.number().optional(),
    def_st_td: z.number().optional(),
    int: z.number().optional(),
    fum_rec: z.number().optional(),
    safe: z.number().optional(),
    sack: z.number().optional(),
    blk_kick: z.number().optional(),
    tkl_loss: z.number().optional(),
    fgm_0_19: z.number().optional(),
    fgm_20_29: z.number().optional(),
    fgm_30_39: z.number().optional(),
    fgm_40_49: z.number().optional(),
    fgm_50p: z.number().optional(),
    fgmiss: z.number().optional(),
    xpmiss: z.number().optional(),
    xpm: z.number().optional(),
  }),
);
type SleeperJsonStats = z.infer<typeof sleeperJsonStats>;

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
      const sleeperLeagueRes = await fetch(
        `https://api.sleeper.app/v1/stats/nfl/regular/${year}/${weekNumber}`,
      );
      const sleeperJson: SleeperJsonStats = sleeperJsonStats.parse(
        await sleeperLeagueRes.json(),
      );

      const promises: Promise<any>[] = [];

      // Score ALL entries from ALL users for this week
      for (const weekRecord of allWeekRecords) {
        for (const entry of weekRecord.entries) {
          const stats = sleeperJson[entry.player.sleeperId] || {};
          let score = 0;

          // Calculate points based on position and stats
          if (entry.player.position === 'QB') {
            score =
              Math.round(
                100 *
                  (0.04 * (stats.pass_yd || 0) +
                    4 * (stats.pass_td || 0) +
                    0.1 * (stats.rush_yd || 0) +
                    6 * (stats.rush_td || 0) +
                    0.1 * (stats.rec_yd || 0) +
                    6 * (stats.rec_td || 0) +
                    -2 * (stats.fum_lost || 0) +
                    -2 * (stats.pass_int || 0) +
                    2 * (stats.pass_2pt || 0) +
                    2 * (stats.rush_2pt || 0) +
                    2 * (stats.rec_2pt || 0)),
              ) / 100;
          } else if (entry.player.position === 'RB') {
            score =
              Math.round(
                100 *
                  (0.1 * (stats.rush_yd || 0) +
                    6 * (stats.rush_td || 0) +
                    0.5 * (stats.rec || 0) +
                    0.1 * (stats.rec_yd || 0) +
                    6 * (stats.rec_td || 0) +
                    -2 * (stats.fum_lost || 0) +
                    2 * (stats.rush_2pt || 0) +
                    2 * (stats.rec_2pt || 0)),
              ) / 100;
          } else if (entry.player.position === 'WR') {
            score =
              Math.round(
                100 *
                  (0.5 * (stats.rec || 0) +
                    0.1 * (stats.rec_yd || 0) +
                    6 * (stats.rec_td || 0) +
                    0.1 * (stats.rush_yd || 0) +
                    6 * (stats.rush_td || 0) +
                    -2 * (stats.fum_lost || 0) +
                    2 * (stats.rec_2pt || 0) +
                    2 * (stats.rush_2pt || 0)),
              ) / 100;
          } else if (entry.player.position === 'TE') {
            score =
              Math.round(
                100 *
                  (0.5 * (stats.rec || 0) +
                    0.1 * (stats.rec_yd || 0) +
                    6 * (stats.rec_td || 0) +
                    0.1 * (stats.rush_yd || 0) +
                    6 * (stats.rush_td || 0) +
                    -2 * (stats.fum_lost || 0) +
                    2 * (stats.rec_2pt || 0) +
                    2 * (stats.rush_2pt || 0)),
              ) / 100;
          } else if (entry.player.position === 'K') {
            score =
              Math.round(
                100 *
                  (3 * (stats.fgm_0_19 || 0) +
                    3 * (stats.fgm_20_29 || 0) +
                    3 * (stats.fgm_30_39 || 0) +
                    4 * (stats.fgm_40_49 || 0) +
                    5 * (stats.fgm_50p || 0) +
                    1 * (stats.xpm || 0) -
                    1 * (stats.fgmiss || 0) -
                    1 * (stats.xpmiss || 0)),
              ) / 100;
          } else if (entry.player.position === 'DEF') {
            let defPoints = 0;
            // Points allowed
            if (stats.pts_allow !== undefined) {
              if (stats.pts_allow <= 20) defPoints += 0;
              else if (stats.pts_allow <= 27) defPoints -= 1;
              else if (stats.pts_allow <= 34) defPoints -= 2;
              else defPoints -= 3;
            }
            // Yards allowed
            if (stats.yds_allow !== undefined) {
              if (stats.yds_allow < 350) defPoints += 0;
              else if (stats.yds_allow <= 399) defPoints -= 1;
              else if (stats.yds_allow <= 449) defPoints -= 1;
              else if (stats.yds_allow <= 499) defPoints -= 2;
              else if (stats.yds_allow <= 549) defPoints -= 2;
              else defPoints -= 3;
            }
            // Other defensive stats
            defPoints +=
              6 * (stats.def_st_td || 0) +
              2 * (stats.int || 0) +
              2 * (stats.fum_rec || 0) +
              4 * (stats.safe || 0) +
              1 * (stats.sack || 0) +
              3 * (stats.blk_kick || 0) +
              0.5 * (stats.tkl_loss || 0);
            score = Math.round(100 * defPoints) / 100;
          }

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

      return typedjson({ message: 'Week has been scored.' });
    }
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
      <Form method='POST'></Form>
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
